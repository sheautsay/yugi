# Creates the Windows 10 22H2 test VM (Hyper-V, Generation 2, Secure Boot) and installs Windows unattended.
# Needs: Hyper-V enabled and the current user in "Hyper-V Administrators" (no full admin needed).
# The Windows ISO is the official Microsoft download; no product key is entered and Windows is not activated.
# The VM's local test account and its generated password are kept in <VmRoot>\win10-test-credentials.txt (outside the project).
param(
  [string]$IsoPath = 'C:\Users\mark.tsai\VMs\Win10_22H2_Chinese_Traditional_x64v1.iso',
  [string]$VmRoot = 'C:\Users\mark.tsai\VMs',
  [string]$VmName = 'YGO-Win10-22H2',
  [Parameter(Mandatory = $true)][int]$ImageIndex,
  # Dynamic memory: starts at 2 GB (Windows 10 x64 minimum) and grows to 4 GB when the host has room.
  [int64]$MemoryBytes = 2GB,
  [int64]$MaxMemoryBytes = 4GB,
  [int64]$DiskBytes = 64GB
)
$ErrorActionPreference = 'Stop'
$vmDir = Join-Path $VmRoot $VmName
New-Item -ItemType Directory -Force $vmDir | Out-Null

# Test account (VM-local only).
$credFile = Join-Path $VmRoot 'win10-test-credentials.txt'
if (-not (Test-Path $credFile)) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 20
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $pw = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  "user=tester`npassword=$pw" | Out-File -Encoding ascii $credFile
}
$pw = ((Get-Content $credFile) -match '^password=')[0].Substring(9)

# Answer file: zh-TW, UEFI/GPT disk layout, local admin "tester" with auto-logon, no online account, no product key.
$xml = @"
<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <SetupUILanguage><UILanguage>zh-TW</UILanguage></SetupUILanguage>
      <InputLocale>0404:00000404</InputLocale><SystemLocale>zh-TW</SystemLocale><UILanguage>zh-TW</UILanguage><UserLocale>zh-TW</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <DiskConfiguration>
        <Disk wcm:action="add">
          <DiskID>0</DiskID><WillWipeDisk>true</WillWipeDisk>
          <CreatePartitions>
            <CreatePartition wcm:action="add"><Order>1</Order><Type>EFI</Type><Size>260</Size></CreatePartition>
            <CreatePartition wcm:action="add"><Order>2</Order><Type>MSR</Type><Size>16</Size></CreatePartition>
            <CreatePartition wcm:action="add"><Order>3</Order><Type>Primary</Type><Extend>true</Extend></CreatePartition>
          </CreatePartitions>
          <ModifyPartitions>
            <ModifyPartition wcm:action="add"><Order>1</Order><PartitionID>1</PartitionID><Format>FAT32</Format><Label>System</Label></ModifyPartition>
            <ModifyPartition wcm:action="add"><Order>2</Order><PartitionID>3</PartitionID><Format>NTFS</Format><Label>Windows</Label><Letter>C</Letter></ModifyPartition>
          </ModifyPartitions>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallFrom><MetaData wcm:action="add"><Key>/IMAGE/INDEX</Key><Value>$ImageIndex</Value></MetaData></InstallFrom>
          <InstallTo><DiskID>0</DiskID><PartitionID>3</PartitionID></InstallTo>
        </OSImage>
      </ImageInstall>
      <UserData><AcceptEula>true</AcceptEula><ProductKey><Key></Key><WillShowUI>OnError</WillShowUI></ProductKey></UserData>
    </component>
  </settings>
  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <ComputerName>YGO-WIN10</ComputerName><TimeZone>Taipei Standard Time</TimeZone>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <InputLocale>0404:00000404</InputLocale><SystemLocale>zh-TW</SystemLocale><UILanguage>zh-TW</UILanguage><UserLocale>zh-TW</UserLocale>
    </component>
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <OOBE>
        <HideEULAPage>true</HideEULAPage><HideOEMRegistrationScreen>true</HideOEMRegistrationScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens><HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC><NetworkLocation>Work</NetworkLocation>
      </OOBE>
      <UserAccounts>
        <LocalAccounts>
          <LocalAccount wcm:action="add">
            <Name>tester</Name><Group>Administrators</Group><DisplayName>tester</DisplayName>
            <Password><Value>$pw</Value><PlainText>true</PlainText></Password>
          </LocalAccount>
        </LocalAccounts>
      </UserAccounts>
      <AutoLogon><Enabled>true</Enabled><Username>tester</Username><LogonCount>9999</LogonCount><Password><Value>$pw</Value><PlainText>true</PlainText></Password></AutoLogon>
      <FirstLogonCommands>
        <SynchronousCommand wcm:action="add"><Order>1</Order><CommandLine>powercfg /change standby-timeout-ac 0</CommandLine></SynchronousCommand>
        <SynchronousCommand wcm:action="add"><Order>2</Order><CommandLine>powercfg /change monitor-timeout-ac 0</CommandLine></SynchronousCommand>
        <SynchronousCommand wcm:action="add"><Order>3</Order><CommandLine>reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoLogonCount /t REG_DWORD /d 9999 /f</CommandLine></SynchronousCommand>
      </FirstLogonCommands>
    </component>
  </settings>
</unattend>
"@
$answerDir = Join-Path $vmDir 'answer'
New-Item -ItemType Directory -Force $answerDir | Out-Null
[IO.File]::WriteAllText((Join-Path $answerDir 'autounattend.xml'), $xml, (New-Object Text.UTF8Encoding $false))

# Answer media: a tiny ISO made with the built-in IMAPI2 COM API (no extra tools).
$answerIso = Join-Path $vmDir 'answer.iso'
$fsi = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
$fsi.FileSystemsToCreate = 3 # ISO9660 + Joliet
$fsi.VolumeName = 'ANSWER'
$fsi.Root.AddTree($answerDir, $false)
$img = $fsi.CreateResultImage()
if (-not ('IsoWriter' -as [type])) {
  Add-Type -TypeDefinition @'
using System; using System.IO; using System.Runtime.InteropServices.ComTypes;
public static class IsoWriter {
  public static void Write(object stream, string path, int blockSize, int blocks) {
    var s = (IStream)stream; var buf = new byte[blockSize]; var ptr = IntPtr.Zero;
    using (var f = File.Create(path)) { for (int i = 0; i < blocks; i++) { s.Read(buf, blockSize, ptr); f.Write(buf, 0, blockSize); } }
  }
}
'@
}
[IsoWriter]::Write($img.ImageStream, $answerIso, $img.BlockSize, $img.TotalBlocks)

# The VM.
if (Get-VM -Name $VmName -ErrorAction SilentlyContinue) { throw "VM $VmName already exists" }
$vhd = Join-Path $vmDir "$VmName.vhdx"
New-VM -Name $VmName -Generation 2 -MemoryStartupBytes $MemoryBytes -NewVHDPath $vhd -NewVHDSizeBytes $DiskBytes -SwitchName 'Default Switch' -Path $VmRoot | Out-Null
Set-VMMemory -VMName $VmName -DynamicMemoryEnabled $true -StartupBytes $MemoryBytes -MinimumBytes 1GB -MaximumBytes $MaxMemoryBytes
Set-VMProcessor -VMName $VmName -Count 2
Set-VM -Name $VmName -AutomaticCheckpointsEnabled $false -CheckpointType Standard
Set-VMFirmware -VMName $VmName -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows
# Service names are localized (a Chinese host has no "Guest Service Interface"), so enable them all by object.
Get-VMIntegrationService -VMName $VmName | Enable-VMIntegrationService
$dvd = Add-VMDvdDrive -VMName $VmName -Path $IsoPath -Passthru
Add-VMDvdDrive -VMName $VmName -Path $answerIso
Set-VMFirmware -VMName $VmName -FirstBootDevice $dvd

# Start and answer "Press any key to boot from CD or DVD" through the VM's virtual keyboard.
Start-VM -Name $VmName
$kb = Get-CimInstance -Namespace root\virtualization\v2 -ClassName Msvm_ComputerSystem -Filter "ElementName='$VmName'" | Get-CimAssociatedInstance -ResultClassName Msvm_Keyboard
for ($i = 0; $i -lt 30; $i++) { $null = Invoke-CimMethod -InputObject $kb -MethodName TypeKey -Arguments @{ keyCode = 13 }; Start-Sleep -Milliseconds 500 }
"VM $VmName started; Windows Setup runs unattended. Wait for PowerShell Direct with wait-win10-vm.ps1."
