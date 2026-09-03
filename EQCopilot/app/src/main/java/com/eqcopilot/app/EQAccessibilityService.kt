package com.eqcopilot.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import android.os.Environment
import java.io.File
import java.io.FileOutputStream

class EQAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "EQAccessibility"

        private const val OVERLAY_HEIGHT_DP = 64
        private const val OVERLAY_GAP_DP = 0

        private const val MAX_SCREENSHOT_WIDTH = 1080
        private const val JPEG_QUALITY = 80

        /**
         * Hackathon demo target.
         * Add more package names here if the product needs to support more chat apps.
         */
        private val SUPPORTED_PACKAGES = setOf(
            "tw.nekomimi.nekogram"
        )

        private val VALID_STYLES = setOf(
            "empathy",
            "concise",
            "affirmative"
        )
    }

    private lateinit var windowManager: WindowManager

    private val mainHandler = Handler(Looper.getMainLooper())
    private val networkExecutor = Executors.newSingleThreadExecutor()

    private var currentWindowId: Int = -1
    private var currentPackageName: String? = null

    private var suggestionWebView: WebView? = null
    private var suggestionParams: WindowManager.LayoutParams? = null

    private var composeInFlight = false

    private val apiClient: ComposeApiClient by lazy {
        ComposeApiClient(
            getString(R.string.compose_endpoint).trim()
        )
    }

    private val repositionRunnable = Runnable {
        updateSuggestionOverlayPosition()
    }

    private fun saveDebugScreenshot(
        bitmap: Bitmap
    ) {
        try {
            val picturesDir =
                getExternalFilesDir(
                    Environment.DIRECTORY_PICTURES
                ) ?: cacheDir

            val file = File(
                picturesDir,
                "eqcopilot_debug_capture.jpg"
            )

            FileOutputStream(file).use { output ->
                bitmap.compress(
                    Bitmap.CompressFormat.JPEG,
                    90,
                    output
                )
            }

            Log.d(
                TAG,
                "📸 Debug screenshot saved: ${file.absolutePath}, " +
                        "${bitmap.width}x${bitmap.height}"
            )

        } catch (e: Exception) {
            Log.e(
                TAG,
                "❌ Failed to save debug screenshot",
                e
            )
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()

        Log.d(TAG, "✅ Accessibility Service connected")

        windowManager =
            getSystemService(WINDOW_SERVICE) as WindowManager

        createSuggestionOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString()
        val windowId = event.windowId
        val eventType = event.eventType

        val isIgnoredTarget =
            packageName == null ||
                    packageName == "com.android.systemui" ||
                    packageName == "com.google.android.inputmethod.latin" ||
                    packageName == this.packageName ||
                    windowId < 0

        if (!isIgnoredTarget) {
            currentPackageName = packageName
            currentWindowId = windowId
        }

        if (
            eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED ||
            eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED
        ) {
            mainHandler.removeCallbacks(repositionRunnable)
            mainHandler.postDelayed(repositionRunnable, 120)
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted")
    }

    private fun createSuggestionOverlay() {
        if (suggestionWebView != null) return

        val webView = WebView(this).apply {
            settings.javaScriptEnabled = true

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d(TAG, "✅ Overlay WebView ready")
                }
            }

            addJavascriptInterface(
                OverlayJsBridge(),
                "Android"
            )

            loadUrl(
                "file:///android_asset/overlay.html"
            )

            visibility = View.GONE
        }

        suggestionWebView = webView

        val heightPx = dpToPx(OVERLAY_HEIGHT_DP)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            heightPx,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
            y = 0
        }

        suggestionParams = params
        windowManager.addView(webView, params)

        webView.postDelayed(
            { updateSuggestionOverlayPosition() },
            250
        )
    }

    private fun updateSuggestionOverlayPosition() {
        val params = suggestionParams ?: return
        val webView = suggestionWebView ?: return

        val imeWindow = windows
            ?.firstOrNull {
                it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD
            }

        val targetPackage = resolveTargetWindow()
            ?.root
            ?.packageName
            ?.toString()
            ?: currentPackageName

        val shouldShow =
            imeWindow != null &&
                    targetPackage in SUPPORTED_PACKAGES

        if (!shouldShow) {
            if (webView.visibility != View.GONE) {
                webView.visibility = View.GONE
            }
            return
        }

        val bounds = Rect()
        imeWindow!!.getBoundsInScreen(bounds)

        val screenHeight = resources.displayMetrics.heightPixels
        val bottomOffset =
            screenHeight - bounds.top + dpToPx(OVERLAY_GAP_DP)

        params.y = bottomOffset

        try {
            windowManager.updateViewLayout(webView, params)

            if (webView.visibility != View.VISIBLE) {
                webView.visibility = View.VISIBLE
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to update suggestion overlay", e)
        }
    }

    /**
     * New product flow:
     * 1. User presses one tone button.
     * 2. Read the current draft once.
     * 3. Capture the current chat window.
     * 4. Encode screenshot as JPEG Base64.
     * 5. POST style + draft + screenshot_base64 to /compose.
     * 6. Fill backend response.text into the current editable field.
     */
    private fun handleCompose(style: String) {
        if (style !in VALID_STYLES) {
            notifyComposeError("Unknown style: $style")
            return
        }

        if (composeInFlight) {
            return
        }

        val focusedNode = findFocusedEditableNode()
        if (focusedNode == null) {
            notifyComposeError("找不到目前的輸入框")
            return
        }

        val draft = focusedNode.text?.toString().orEmpty()

        val targetWindow = resolveTargetWindow()
        if (targetWindow == null) {
            notifyComposeError("找不到目前聊天室 window")
            return
        }

        val requestWindowId = targetWindow.id
        val requestPackage = targetWindow.root
            ?.packageName
            ?.toString()
            .orEmpty()

        if (requestPackage !in SUPPORTED_PACKAGES) {
            notifyComposeError("目前 App 尚未支援")
            return
        }

        composeInFlight = true
        notifyComposeStarted(style)

        captureWindowAsBase64(
            targetWindow = targetWindow
        ) { screenshotResult ->
            screenshotResult
                .onSuccess { screenshotBase64 ->
                    Log.d(
                        TAG,
                        "🎨 style=$style draftLength=${draft.length} base64Length=${screenshotBase64.length}"
                    )

                    sendComposeRequest(
                        style = style,
                        draft = draft,
                        screenshotBase64 = screenshotBase64,
                        requestWindowId = requestWindowId,
                        requestPackage = requestPackage
                    )
                }
                .onFailure { error ->
                    composeInFlight = false
                    notifyComposeError(
                        error.message ?: "Screenshot failed"
                    )
                }
        }
    }

    private fun sendComposeRequest(
        style: String,
        draft: String,
        screenshotBase64: String,
        requestWindowId: Int,
        requestPackage: String
    ) {
        networkExecutor.execute {
            val result = apiClient.compose(
                style = style,
                draft = draft,
                screenshotBase64 = screenshotBase64
            )

            mainHandler.post {
                result
                    .onSuccess { generatedText ->
                        if (
                            !isRequestContextStillActive(
                                requestWindowId,
                                requestPackage
                            )
                        ) {
                            composeInFlight = false
                            notifyComposeError(
                                "聊天室已切換，因此沒有自動填入舊回覆"
                            )
                            return@onSuccess
                        }

                        val applied = replaceFocusedDraft(
                            generatedText
                        )

                        composeInFlight = false

                        if (applied) {
                            notifyComposeFinished(
                                generatedText
                            )
                        } else {
                            notifyComposeError(
                                "AI 已回覆，但無法填入目前輸入框"
                            )
                        }
                    }
                    .onFailure { error ->
                        composeInFlight = false
                        notifyComposeError(
                            error.message ?: "Backend request failed"
                        )
                    }
            }
        }
    }

    private fun captureWindowAsBase64(
        targetWindow: AccessibilityWindowInfo,
        onResult: (Result<String>) -> Unit
    ) {
        val targetWindowId = targetWindow.id

        takeScreenshotOfWindow(
            targetWindowId,
            mainExecutor,
            object : TakeScreenshotCallback {

                override fun onSuccess(
                    screenshot: ScreenshotResult
                ) {
                    val hardwareBuffer = screenshot.hardwareBuffer

                    try {
                        val hardwareBitmap = Bitmap.wrapHardwareBuffer(
                            hardwareBuffer,
                            screenshot.colorSpace
                        ) ?: throw IllegalStateException(
                            "Could not create Bitmap from screenshot"
                        )

                        val softwareBitmap = hardwareBitmap.copy(
                            Bitmap.Config.ARGB_8888,
                            false
                        ) ?: throw IllegalStateException(
                            "Could not copy screenshot Bitmap"
                        )

                        val resizedBitmap = resizeForBackend(
                            softwareBitmap
                        )

// DEBUG：保存真正送給 backend 的圖片
                        saveDebugScreenshot(
                            resizedBitmap
                        )

                        val base64 = bitmapToBase64(
                            resizedBitmap
                        )

                        Log.d(
                            TAG,
                            "📦 Screenshot base64 length=${base64.length}, " +
                                    "size=${resizedBitmap.width}x${resizedBitmap.height}"
                        )

                        if (resizedBitmap !== softwareBitmap) {
                            resizedBitmap.recycle()
                        }

                        softwareBitmap.recycle()

                        onResult(
                            Result.success(base64)
                        )

                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Screenshot conversion failed", e)
                        onResult(Result.failure(e))
                    } finally {
                        hardwareBuffer.close()
                    }
                }

                override fun onFailure(errorCode: Int) {
                    onResult(
                        Result.failure(
                            IllegalStateException(
                                "Screenshot failed, errorCode=$errorCode"
                            )
                        )
                    )
                }
            }
        )
    }

    private fun resizeForBackend(bitmap: Bitmap): Bitmap {
        if (bitmap.width <= MAX_SCREENSHOT_WIDTH) {
            return bitmap
        }

        val ratio =
            MAX_SCREENSHOT_WIDTH.toFloat() / bitmap.width.toFloat()

        val newHeight =
            (bitmap.height * ratio).toInt()

        return Bitmap.createScaledBitmap(
            bitmap,
            MAX_SCREENSHOT_WIDTH,
            newHeight,
            true
        )
    }


    private fun bitmapToBase64(bitmap: Bitmap): String {
        val output = ByteArrayOutputStream()

        bitmap.compress(
            Bitmap.CompressFormat.JPEG,
            JPEG_QUALITY,
            output
        )

        return Base64.encodeToString(
            output.toByteArray(),
            Base64.NO_WRAP
        )
    }

    private fun replaceFocusedDraft(replacement: String): Boolean {
        val node = findFocusedEditableNode()
            ?: return false

        val args = Bundle().apply {
            putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                replacement
            )
        }

        val success = node.performAction(
            AccessibilityNodeInfo.ACTION_SET_TEXT,
            args
        )

        if (success) {
            Log.d(TAG, "✅ Generated text filled into draft")
        }

        return success
    }

    private fun findFocusedEditableNode(): AccessibilityNodeInfo? {
        windows?.forEach { window ->
            val root = window.root ?: return@forEach
            val focused = root.findFocus(
                AccessibilityNodeInfo.FOCUS_INPUT
            )

            if (
                focused != null &&
                focused.isEditable &&
                focused.packageName?.toString() in SUPPORTED_PACKAGES
            ) {
                return focused
            }
        }

        return null
    }

    private fun resolveTargetWindow(): AccessibilityWindowInfo? {
        val allWindows = windows ?: return null

        val activeSupportedApp = allWindows.firstOrNull { window ->
            val packageName = window.root
                ?.packageName
                ?.toString()

            window.type == AccessibilityWindowInfo.TYPE_APPLICATION &&
                    window.isActive &&
                    packageName in SUPPORTED_PACKAGES
        }

        if (activeSupportedApp != null) {
            return activeSupportedApp
        }

        return allWindows.firstOrNull { window ->
            val packageName = window.root
                ?.packageName
                ?.toString()

            window.type == AccessibilityWindowInfo.TYPE_APPLICATION &&
                    packageName == currentPackageName &&
                    packageName in SUPPORTED_PACKAGES
        }
    }

    private fun isRequestContextStillActive(
        requestWindowId: Int,
        requestPackage: String
    ): Boolean {
        val currentTarget = resolveTargetWindow()
            ?: return false

        val packageName = currentTarget.root
            ?.packageName
            ?.toString()

        return currentTarget.id == requestWindowId &&
                packageName == requestPackage
    }

    private fun notifyComposeStarted(style: String) {
        evaluateJavascript(
            """
            window.onComposeStarted &&
            window.onComposeStarted(${JSONObject.quote(style)});
            """.trimIndent()
        )
    }

    private fun notifyComposeFinished(text: String) {
        evaluateJavascript(
            """
            window.onComposeFinished &&
            window.onComposeFinished(${JSONObject.quote(text)});
            """.trimIndent()
        )
    }

    private fun notifyComposeError(message: String) {
        evaluateJavascript(
            """
            window.onComposeError &&
            window.onComposeError(${JSONObject.quote(message)});
            """.trimIndent()
        )
    }

    private fun evaluateJavascript(script: String) {
        suggestionWebView?.post {
            suggestionWebView?.evaluateJavascript(
                script,
                null
            )
        }
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        mainHandler.removeCallbacks(repositionRunnable)

        suggestionWebView?.let { webView ->
            try {
                windowManager.removeView(webView)
            } catch (_: Exception) {
            }

            webView.destroy()
        }

        suggestionWebView = null
        suggestionParams = null

        networkExecutor.shutdownNow()

        super.onDestroy()
    }

    inner class OverlayJsBridge {

        @JavascriptInterface
        fun compose(style: String) {
            mainHandler.post {
                handleCompose(style)
            }
        }
    }
}