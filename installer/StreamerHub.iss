#define MyAppVersion GetEnv("APP_VERSION")

[Setup]
AppId={{D6A0D4B9-3B24-4A9C-9EA1-123456789001}
AppName=Streamer Hub
AppVersion={#MyAppVersion}
AppPublisher=Streamer Hub
DefaultDirName={localappdata}\Programs\Streamer Hub
DefaultGroupName=Streamer Hub
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=yes
OutputDir=..\release\installer
OutputBaseFilename=StreamerHub-Setup-v{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\streamer-hub-icon.ico
UninstallDisplayIcon={app}\StreamerHub.exe
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "..\release\StreamerHub\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Streamer Hub"; Filename: "{app}\StreamerHub.exe"
Name: "{autodesktop}\Streamer Hub"; Filename: "{app}\StreamerHub.exe"

[Run]
Filename: "{app}\StreamerHub.exe"; Description: "Launch Streamer Hub"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

