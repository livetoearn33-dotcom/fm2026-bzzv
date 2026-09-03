package com.eqcopilot.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.RenderProcessGoneDetail
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {

    companion object {
        private const val PREFS_NAME = "eqcopilot_preferences"
        private const val KEY_KNOWLEDGE_BASE = "knowledge_base_snapshot"
    }

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->

            val callback = filePathCallback ?: return@registerForActivityResult
            filePathCallback = null

            if (result.resultCode != Activity.RESULT_OK) {
                callback.onReceiveValue(null)
                return@registerForActivityResult
            }

            val data = result.data
            val uris = mutableListOf<Uri>()

            data?.clipData?.let { clip ->
                for (i in 0 until clip.itemCount) {
                    uris += clip.getItemAt(i).uri
                }
            }

            data?.data?.let { uri ->
                if (uris.none { it == uri }) {
                    uris += uri
                }
            }

            callback.onReceiveValue(
                if (uris.isEmpty()) null else uris.toTypedArray()
            )
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            overScrollMode = WebView.OVER_SCROLL_NEVER

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true

            webViewClient = object : WebViewClient() {

                override fun onRenderProcessGone(
                    view: WebView?,
                    detail: RenderProcessGoneDetail?
                ): Boolean {

                    android.util.Log.e(
                        "EQCopilot",
                        "Renderer crashed = ${detail?.didCrash()}"
                    )

                    view?.destroy()
                    recreate()

                    return true
                }
            }

            webChromeClient = object : WebChromeClient() {

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePath: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {

                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = filePath

                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/pdf"
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }

                    fileChooserLauncher.launch(intent)
                    return true
                }
            }

            addJavascriptInterface(
                AppJsBridge(),
                "AndroidApp"
            )

            loadUrl("file:///android_asset/app-settings.html")
        }

        setContentView(
            webView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
    }

    inner class AppJsBridge {

        @JavascriptInterface
        fun saveKnowledgeBase(json: String) {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(KEY_KNOWLEDGE_BASE, json)
                .apply()
        }

        @JavascriptInterface
        fun loadKnowledgeBase(): String {
            return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString(KEY_KNOWLEDGE_BASE, "")
                .orEmpty()
        }

        @JavascriptInterface
        fun openAccessibilitySettings() {
            runOnUiThread {
                startActivity(
                    Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                )
            }
        }
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null

        webView.removeJavascriptInterface("AndroidApp")
        webView.destroy()

        super.onDestroy()
    }
}
