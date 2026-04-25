$body = @{
    input = @{
        text = "Writing code in VS Code"
    }
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri 'http://127.0.0.1:3400/categorizeContext' `
    -Method POST `
    -Body $body `
    -ContentType 'application/json' `
    -UseBasicParsing

Write-Host "Status Code: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
