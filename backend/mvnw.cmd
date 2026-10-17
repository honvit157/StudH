@REM ----------------------------------------------------------------------------
@REM Maven Wrapper for Windows
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "MAVEN_VERSION=3.9.9"
set "MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip"
set "DIR=%~dp0"
set "MAVEN_HOME=%DIR%.mvn\apache-maven-%MAVEN_VERSION%"

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
    echo Downloading Maven %MAVEN_VERSION% wrapper...
    if not exist "%DIR%.mvn" mkdir "%DIR%.mvn"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%MAVEN_URL%', '%DIR%.mvn\maven.zip'); Expand-Archive -Path '%DIR%.mvn\maven.zip' -DestinationPath '%DIR%.mvn' -Force; Remove-Item '%DIR%.mvn\maven.zip' -Force"
)

if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    call "%MAVEN_HOME%\bin\mvn.cmd" %*
) else (
    echo Failed to prepare Maven wrapper.
    exit /b 1
)
