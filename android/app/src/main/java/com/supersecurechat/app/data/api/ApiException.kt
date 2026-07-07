package com.supersecurechat.app.data.api

class ApiException(
    val statusCode: Int,
    val detail: String,
) : Exception(detail)