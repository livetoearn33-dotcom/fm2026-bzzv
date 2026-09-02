package com.eqcopilot.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import java.io.File
import java.io.FileOutputStream
import android.graphics.PixelFormat
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityWindowInfo
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityNodeInfo
import android.graphics.Rect
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient

class EQAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "EQAccessibility"
        private const val DRAFT_DEBOUNCE_MS = 180L
    }

    private lateinit var windowManager: WindowManager

    private var currentWindowId: Int = -1
    private var currentPackageName: String? = null

    private val draftHandler =
        Handler(Looper.getMainLooper())

    private var draftRunnable: Runnable? = null

    private var latestDraft: String = ""

    private var suggestionWebView: WebView? = null

    private var suggestionParams:
            WindowManager.LayoutParams? = null

    override fun onServiceConnected() {
        super.onServiceConnected()

        Log.d(TAG, "✅ Accessibility Service connected")

        windowManager =
            getSystemService(WINDOW_SERVICE) as WindowManager

        createSuggestionOverlay()
    }

    private fun createSuggestionOverlay() {

        if (suggestionWebView != null) {
            return
        }

        val webView =
            WebView(this).apply {

                settings.javaScriptEnabled =
                    true

                webViewClient =
                    object : WebViewClient() {

                        override fun onPageFinished(
                            view: WebView?,
                            url: String?
                        ) {
                            super.onPageFinished(
                                view,
                                url
                            )

                            Log.d(
                                TAG,
                                "✅ Overlay WebView ready"
                            )

                            // WebView 剛載入完成，
                            // 把目前已知的 draft 再同步一次
                            pushDraftToOverlay(
                                latestDraft
                            )
                        }
                    }

                addJavascriptInterface(
                    OverlayJsBridge(),
                    "Android"
                )

                loadUrl(
                    "file:///android_asset/overlay_bridge_test.html"
                )
                // 一開始完全不要顯示
                visibility = View.GONE
            }

        suggestionWebView =
            webView


        val heightPx =
            (90 * resources.displayMetrics.density)
                .toInt()


        val params =
            WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                heightPx,

                WindowManager.LayoutParams
                    .TYPE_ACCESSIBILITY_OVERLAY,

                WindowManager.LayoutParams
                    .FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams
                            .FLAG_LAYOUT_IN_SCREEN,

                PixelFormat.TRANSLUCENT
            )


        params.gravity =
            Gravity.BOTTOM


        /*
         * 第一版先固定放在 Gboard 上方。
         *
         * 之後再改成動態讀
         * TYPE_INPUT_METHOD window 高度。
         */
        params.y = 0
        suggestionParams =
            params

        windowManager.addView(
            webView,
            params
        )

        Log.d(
            TAG,
            "✅ Suggestion WebView overlay created"
        )

        suggestionWebView?.postDelayed(
            {
                updateSuggestionOverlayPosition()
            },
            250
        )
    }

    private fun updateSuggestionOverlayPosition() {

        val params =
            suggestionParams
                ?: return

        val webView =
            suggestionWebView
                ?: return

        val imeWindow =
            windows?.firstOrNull { window ->
                window.type ==
                        AccessibilityWindowInfo.TYPE_INPUT_METHOD
            }

        /*
         * 沒有軟鍵盤：
         * EQ 建議條完全隱藏
         */
        if (imeWindow == null) {

            if (webView.visibility != View.GONE) {

                webView.visibility =
                    View.GONE

                Log.d(
                    TAG,
                    "🙈 IME hidden → suggestion overlay hidden"
                )
            }

            return
        }


        /*
         * 有軟鍵盤：
         * 取得它真正的位置
         */
        val bounds =
            Rect()

        imeWindow.getBoundsInScreen(
            bounds
        )

        val screenHeight =
            resources
                .displayMetrics
                .heightPixels

        val extraGapDp = 12

        val extraGapPx =
            (
                    extraGapDp *
                            resources.displayMetrics.density
                    ).toInt()

        val bottomOffset =
            screenHeight -
                    bounds.top +
                    extraGapPx

        params.y =
            bottomOffset


        try {

            windowManager
                .updateViewLayout(
                    webView,
                    params
                )

            /*
             * 位置算好後才顯示，
             * 避免一瞬間出現在錯誤位置。
             */
            if (
                webView.visibility !=
                View.VISIBLE
            ) {

                webView.visibility =
                    View.VISIBLE

                /*
                 * 鍵盤剛出現時再保險讀一次。
                 * 可以處理：
                 * - 輸入框原本已有文字
                 * - Accessibility service 剛重連
                 * - Focus event 比 WebView load 更早發生
                 */
                readFocusedDraftNow()
            }


            Log.d(
                TAG,
                """
            👀 IME visible → suggestion overlay shown
            imeTop=${bounds.top}
            imeBottom=${bounds.bottom}
            bottomOffset=$bottomOffset
            """.trimIndent()
            )

        } catch (e: Exception) {

            Log.e(
                TAG,
                "❌ Failed to update suggestion overlay",
                e
            )
        }
    }

    private fun readFocusedDraftNow() {

        val node =
            findFocusedEditableNode()
                ?: return

        val draft =
            node.text
                ?.toString()
                ?: ""

        latestDraft =
            draft

        Log.d(
            TAG,
            "🎯 Current focused draft = [$draft]"
        )

        pushDraftToOverlay(
            draft
        )
    }

    override fun onAccessibilityEvent(
        event: AccessibilityEvent?
    ) {
        if (event == null) return

        val packageName =
            event.packageName
                ?.toString()

        val windowId =
            event.windowId

        val eventType =
            event.eventType

        val isNekogram =
            packageName ==
                    "tw.nekomimi.nekogram"

        val isIgnoredTarget =
            packageName == null ||
                    packageName == "com.android.systemui" ||
                    packageName == "com.google.android.inputmethod.latin" ||
                    packageName == this.packageName ||
                    windowId < 0


        // =====================================================
        // 1. 追蹤真正的宿主 App window
        //
        // 不要讓 System UI、Gboard、EQCopilot 自己
        // 覆蓋目前真正要截圖的 App window。
        // =====================================================

        if (!isIgnoredTarget) {

            currentPackageName =
                packageName

            currentWindowId =
                windowId

            Log.d(
                TAG,
                """
            ✅ Target window
            package=$currentPackageName
            windowId=$currentWindowId
            """.trimIndent()
            )
        }


        // =====================================================
        // 2. 使用者正在輸入：
        //    即時取得 Nekogram draft，再交給 debounce
        // =====================================================

        if (
            eventType ==
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
            isNekogram
        ) {

            val source =
                event.source

            if (
                source != null &&
                source.isEditable
            ) {

                val draft =
                    source.text
                        ?.toString()
                        ?: ""

                Log.d(
                    TAG,
                    "📝 Gboard draft changed = [$draft]"
                )

                onDraftChanged(
                    draft
                )
            }
        }


        // =====================================================
        // 3. 輸入框剛取得 Focus：
        //
        // 如果裡面本來就有文字，
        // 不會觸發 TYPE_VIEW_TEXT_CHANGED，
        // 所以這裡必須主動讀一次。
        //
        // Focus 時不 debounce，立即同步到 WebView。
        // =====================================================

        if (
            eventType ==
            AccessibilityEvent.TYPE_VIEW_FOCUSED &&
            isNekogram
        ) {

            val source =
                event.source

            if (
                source != null &&
                source.isEditable
            ) {

                val draft =
                    source.text
                        ?.toString()
                        ?: ""

                // 避免先前還排著一個舊的 debounce
                draftRunnable?.let {
                    draftHandler.removeCallbacks(it)
                }

                latestDraft =
                    draft

                Log.d(
                    TAG,
                    "🎯 Focused draft = [$draft]"
                )

                pushDraftToOverlay(
                    draft
                )
            }
        }


        // =====================================================
        // 4. Window / Focus 有變動時，
        //    重新判斷 Gboard 是否存在以及 overlay 位置。
        //
        // 注意：
        // 這段不能因為 package 是 SystemUI/Gboard 就提前 return，
        // 否則鍵盤收起時 overlay 可能不會消失。
        // =====================================================

        if (
            eventType ==
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            eventType ==
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            eventType ==
            AccessibilityEvent.TYPE_WINDOWS_CHANGED ||
            eventType ==
            AccessibilityEvent.TYPE_VIEW_FOCUSED
        ) {

            draftHandler.removeCallbacks(
                repositionRunnable
            )

            draftHandler.postDelayed(
                repositionRunnable,
                120
            )
        }
    }

    private val repositionRunnable =
        Runnable {
            updateSuggestionOverlayPosition()
        }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted")
    }

    private fun onDraftChanged(
        draft: String
    ) {

        latestDraft =
            draft

        draftRunnable?.let {
            draftHandler.removeCallbacks(it)
        }

        val runnable =
            Runnable {

                Log.d(
                    TAG,
                    "📝 Stable draft = [$latestDraft]"
                )
                pushDraftToOverlay(
                    latestDraft
                )

                // 之後這裡就是：
                // /guard(latestDraft)
            }

        draftRunnable =
            runnable

        draftHandler.postDelayed(
            runnable,
            DRAFT_DEBOUNCE_MS
        )
    }

    private fun pushDraftToOverlay(
        draft: String
    ) {

        val safeDraft =
            org.json.JSONObject
                .quote(draft)


        suggestionWebView
            ?.post {

                suggestionWebView
                    ?.evaluateJavascript(
                        """
                    window.onNativeDraftChanged &&
                    window.onNativeDraftChanged(
                        $safeDraft
                    );
                    """.trimIndent(),
                        null
                    )
            }
    }
    private fun resolveTargetWindow(): AccessibilityWindowInfo? {

        val allWindows =
            windows ?: return null

        Log.d(
            TAG,
            "🔎 Resolving target from ${allWindows.size} windows"
        )

        allWindows.forEach { window ->

            val packageName =
                window.root
                    ?.packageName
                    ?.toString()

            Log.d(
                TAG,
                """
            WINDOW
              id=${window.id}
              type=${window.type}
              active=${window.isActive}
              focused=${window.isFocused}
              package=$packageName
            """.trimIndent()
            )
        }

        /*
         * 第一優先：
         * 找目前 active 的一般 App window，
         * 並排除 EQCopilot 自己與 System UI。
         */
        val activeApp =
            allWindows.firstOrNull { window ->

                val packageName =
                    window.root
                        ?.packageName
                        ?.toString()

                window.type ==
                        AccessibilityWindowInfo.TYPE_APPLICATION &&
                        window.isActive &&
                        packageName != null &&
                        packageName != this.packageName &&
                        packageName != "com.android.systemui"
            }

        if (activeApp != null) {
            return activeApp
        }

        /*
         * 第二優先：
         * 如果 active flag 因為 IME 而不理想，
         * 就用我們最後知道的 target package 找。
         */
        return allWindows.firstOrNull { window ->

            val packageName =
                window.root
                    ?.packageName
                    ?.toString()

            window.type ==
                    AccessibilityWindowInfo.TYPE_APPLICATION &&
                    packageName == currentPackageName
        }
    }
    fun captureCurrentWindow(
        onResult: (Result<String>) -> Unit = {}
    ) {

        val targetWindow =
            resolveTargetWindow()

        if (targetWindow == null) {

            val error =
                IllegalStateException(
                    "No valid application window found"
                )

            Log.e(
                TAG,
                "❌ ${error.message}"
            )

            onResult(
                Result.failure(error)
            )

            return
        }

        val targetWindowId =
            targetWindow.id

        val targetPackage =
            targetWindow.root
                ?.packageName
                ?.toString()

        Log.d(
            TAG,
            """
        📸 Screenshot requested
        package = $targetPackage
        freshWindowId = $targetWindowId
        """.trimIndent()
        )

        takeScreenshotOfWindow(
            targetWindowId,
            mainExecutor,
            object : TakeScreenshotCallback {

                override fun onSuccess(
                    screenshot: ScreenshotResult
                ) {

                    Log.d(
                        TAG,
                        "✅ Screenshot captured"
                    )

                    val hardwareBuffer =
                        screenshot.hardwareBuffer

                    try {

                        val hardwareBitmap =
                            Bitmap.wrapHardwareBuffer(
                                hardwareBuffer,
                                screenshot.colorSpace
                            )

                        if (hardwareBitmap == null) {

                            Log.e(
                                TAG,
                                "❌ Could not create Bitmap"
                            )

                            return
                        }

                        val bitmap =
                            hardwareBitmap.copy(
                                Bitmap.Config.ARGB_8888,
                                false
                            )

                        if (bitmap == null) {

                            Log.e(
                                TAG,
                                "❌ Could not copy Bitmap"
                            )

                            return
                        }

                        val path =
                            saveScreenshotToApp(bitmap)

                        Log.d(
                            TAG,
                            "✅ Screenshot ready for caller: $path"
                        )

                        onResult(
                            Result.success(path)
                        )

                        bitmap.recycle()

                    } catch (e: Exception) {

                        Log.e(
                            TAG,
                            "❌ Screenshot conversion failed",
                            e
                        )

                        onResult(
                            Result.failure(e)
                        )
                    } finally {

                        hardwareBuffer.close()
                    }
                }

                override fun onFailure(
                    errorCode: Int
                ) {

                    val error =
                        IllegalStateException(
                            "Screenshot failed, errorCode=$errorCode"
                        )

                    Log.e(
                        TAG,
                        "❌ ${error.message}"
                    )

                    onResult(
                        Result.failure(error)
                    )
                }
            }
        )
    }

    fun replaceFocusedDraft(
        replacement: String
    ): Boolean {

        val node =
            findFocusedEditableNode()
                ?: run {

                    Log.e(
                        TAG,
                        "❌ No focused editable node"
                    )

                    return false
                }


        val args =
            Bundle().apply {

                putCharSequence(
                    AccessibilityNodeInfo
                        .ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    replacement
                )
            }


        val success =
            node.performAction(
                AccessibilityNodeInfo.ACTION_SET_TEXT,
                args
            )


        if (success) {

            /*
             * 1. 取消舊 draft 尚未執行的 debounce。
             *
             * 否則使用者剛才輸入的舊文字，
             * 可能在替換完成後又被推回 WebView。
             */
            draftRunnable?.let {
                draftHandler.removeCallbacks(it)
            }


            /*
             * 2. 我們已經知道新的正確文字是什麼，
             * 不需要等 Accessibility 再送 event。
             */
            latestDraft =
                replacement


            /*
             * 3. 立即更新 WebView。
             */
            pushDraftToOverlay(
                replacement
            )


            Log.d(
                TAG,
                "✅ Draft replaced = [$replacement]"
            )


            /*
             * 4. 再稍微延遲後從真正的宿主 EditText
             * 重新讀一次，確保我們的 state
             * 和 Nekogram 最終狀態完全一致。
             *
             * 例如宿主 App 有自行格式化文字時，
             * 這一步可以把實際結果同步回來。
             */
            draftHandler.postDelayed(
                {
                    readFocusedDraftNow()
                },
                80
            )

        } else {

            Log.e(
                TAG,
                "❌ ACTION_SET_TEXT failed"
            )
        }


        return success
    }
    private fun findFocusedEditableNode():
            AccessibilityNodeInfo? {

        windows.forEach { window ->

            val root =
                window.root
                    ?: return@forEach

            val focused =
                root.findFocus(
                    AccessibilityNodeInfo.FOCUS_INPUT
                )

            if (
                focused != null &&
                focused.isEditable
            ) {

                return focused
            }
        }

        return null
    }

    private fun saveScreenshotToApp(
        bitmap: Bitmap
    ): String {

        val file =
            File(
                cacheDir,
                "latest_capture.jpg"
            )

        FileOutputStream(file).use { stream ->

            bitmap.compress(
                Bitmap.CompressFormat.JPEG,
                90,
                stream
            )
        }

        Log.d(
            TAG,
            "✅ Screenshot stored in app: ${file.absolutePath}"
        )

        return file.absolutePath
    }


    override fun onDestroy() {

        draftRunnable?.let {
            draftHandler.removeCallbacks(it)
        }
        draftHandler.removeCallbacks(repositionRunnable)

        suggestionWebView?.let { webView ->
            try {
                windowManager.removeView(webView)
            } catch (_: Exception) {
            }
            webView.destroy()
        }
        suggestionWebView = null
        suggestionParams = null

        super.onDestroy()
    }

    private fun getInputMethodTop(): Int? {

        val allWindows =
            windows ?: return null

        val imeWindow =
            allWindows.firstOrNull { window ->
                window.type ==
                        AccessibilityWindowInfo.TYPE_INPUT_METHOD
            } ?: return null

        val bounds =
            Rect()

        imeWindow.getBoundsInScreen(
            bounds
        )

        Log.d(
            TAG,
            """
        ⌨️ IME window
        id=${imeWindow.id}
        top=${bounds.top}
        bottom=${bounds.bottom}
        height=${bounds.height()}
        """.trimIndent()
        )

        return bounds.top
    }
    inner class OverlayJsBridge {

        @JavascriptInterface
        fun replaceDraft(
            text: String
        ) {

            draftHandler.post {

                replaceFocusedDraft(
                    text
                )
            }
        }


        @JavascriptInterface
        fun attachScreenshot() {

            draftHandler.post {

                captureCurrentWindow { result ->

                    result
                        .onSuccess { path ->

                            val safePath =
                                org.json.JSONObject
                                    .quote(path)

                            suggestionWebView
                                ?.post {

                                    suggestionWebView
                                        ?.evaluateJavascript(
                                            """
                                        window.onScreenshotAttached &&
                                        window.onScreenshotAttached(
                                            $safePath
                                        );
                                        """.trimIndent(),
                                            null
                                        )
                                }
                        }

                        .onFailure { error ->

                            val message =
                                org.json.JSONObject.quote(
                                    error.message
                                        ?: "Screenshot failed"
                                )

                            suggestionWebView
                                ?.post {

                                    suggestionWebView
                                        ?.evaluateJavascript(
                                            """
                                        window.onScreenshotError &&
                                        window.onScreenshotError(
                                            $message
                                        );
                                        """.trimIndent(),
                                            null
                                        )
                                }
                        }
                }
            }
        }
    }
}
