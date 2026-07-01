# Android Local Development & LAN Debugging

To prevent accidental transmission of cleartext data in production, the release configurations strictly enforce HTTPS. 
However, for local development or testing with a local backend server over Wi-Fi/LAN, cleartext exceptions can be configured.

### Using the Debug Config Overlay

Android uses source set merging. The configuration file under `frontend/android/app/src/debug/res/xml/network_security_config.xml` is merged only in debug builds and is excluded from release builds.

To connect your debug Android client to a local development machine running the backend:

1. Locate your computer's local IP address (e.g. `192.168.1.50` on Windows via `ipconfig`, or macOS/Linux via `ifconfig`).
2. Open `frontend/android/app/src/debug/res/xml/network_security_config.xml`.
3. Add a `<domain>` entry for your IP address inside the `<domain-config>` element:
   ```xml
   <domain-config cleartextTrafficPermitted="true">
       <domain includeSubdomains="true">localhost</domain>
       <domain includeSubdomains="true">127.0.0.1</domain>
       <domain includeSubdomains="true">10.0.2.2</domain>
       <!-- Add your local machine IP below -->
       <domain includeSubdomains="true">192.168.1.50</domain>
   </domain-config>
   ```

> [!WARNING]
   > Do not commit your personal/local IP address to the git repository. Keep those changes local.
