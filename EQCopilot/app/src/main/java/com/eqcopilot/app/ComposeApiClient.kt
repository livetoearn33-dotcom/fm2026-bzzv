package com.eqcopilot.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Synchronous /compose client. Call it from a background thread.
 *
 * Request JSON:
 * {
 *   "style": "empathy" | "concise" | "affirmative",
 *   "draft": "...",                         // may be empty
 *   "screenshot_base64": "...",             // raw Base64, no data: prefix
 *   "screenshot_mime_type": "image/jpeg"
 * }
 *
 * Expected response JSON:
 * {
 *   "text": "generated or rewritten text"
 * }
 */
class ComposeApiClient(
    private val endpoint: String
) {

    fun compose(
        style: String,
        draft: String,
        screenshotBase64: String
    ): Result<String> {
        if (endpoint.isBlank()) {
            return Result.failure(
                IllegalStateException(
                    "Backend endpoint 尚未設定：請填 app/src/main/res/values/strings.xml 的 compose_endpoint"
                )
            )
        }

        var connection: HttpURLConnection? = null

        return try {
            val payload = JSONObject().apply {
                put("style", style)
                put("draft", draft)
                put("screenshot_base64", screenshotBase64)
                put("screenshot_mime_type", "image/jpeg")
            }

            connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 30_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
            }

            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                writer.write(payload.toString())
            }

            val code = connection.responseCode
            val stream = if (code in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val body = stream
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { it.readText() }
                .orEmpty()

            if (code !in 200..299) {
                throw IllegalStateException(
                    "Backend HTTP $code${if (body.isNotBlank()) ": $body" else ""}"
                )
            }

            val text = JSONObject(body)
                .optString("text")
                .trim()

            if (text.isEmpty()) {
                throw IllegalStateException(
                    "Backend response 缺少非空的 text 欄位"
                )
            }

            Result.success(text)

        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection?.disconnect()
        }
    }
}