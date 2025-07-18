# OpenStudio MCP Server Windows Installation Script

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

# Define installation paths
$installDir = "$env:ProgramFiles\OpenStudio-MCP-Server"
$configDir = "$env:USERPROFILE\.openstudio-mcp-server"
$binPath = "$installDir\openstudio-mcp-server.exe"

# Create directories
Write-Host "Creating installation directories..." -ForegroundColor Cyan
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Copy executable
Write-Host "Installing OpenStudio MCP Server..." -ForegroundColor Cyan
Copy-Item -Path ".\bin\openstudio-mcp-server-win.exe" -Destination $binPath -Force

# Create default configuration if it doesn't exist
$configPath = "$configDir\.env"
if (-not (Test-Path $configPath)) {
    Write-Host "Creating default configuration..." -ForegroundColor Cyan
    & $binPath --generate-config
    
    # Move the generated config to the user config directory
    if (Test-Path ".\.env") {
        Move-Item -Path ".\.env" -Destination $configPath -Force
    }
}

# Create measures directory
$measuresDir = "$configDir\measures"
if (-not (Test-Path $measuresDir)) {
    New-Item -ItemType Directory -Path $measuresDir -Force | Out-Null
}

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if (-not $currentPath.Contains($installDir)) {
    Write-Host "Adding to PATH..." -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "Machine")
}

# Create shortcut in Start Menu
$startMenuPath = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\OpenStudio MCP Server"
if (-not (Test-Path $startMenuPath)) {
    New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
}

$shortcutPath = "$startMenuPath\OpenStudio MCP Server.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $binPath
$Shortcut.WorkingDirectory = $installDir
$Shortcut.Description = "OpenStudio MCP Server"
$Shortcut.Save()

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "OpenStudio MCP Server has been installed to: $installDir" -ForegroundColor Green
Write-Host "Configuration directory: $configDir" -ForegroundColor Green
Write-Host "You can now run 'openstudio-mcp-server' from the command line." -ForegroundColor Green