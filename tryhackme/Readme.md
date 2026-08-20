# 🎯 TryHackMe Write-ups

En este apartado documento mi paso por la plataforma TryHackMe, detallando la resolución de máquinas, retos de redes y rutas de aprendizaje (_Learning Paths_).

## 📊 Resumen de Actividad
- __Perfil de THM:__ _pcxroot_
- __Enfoque:__ Enumeración de red, explotación de servicios web y escalada de privilegios en Linux/Windows.

## 📂 Contenido del Directorio

Las resoluciones están organizadas por el nombre de la sala o máquina:

| Sala/Máquina | Dificultad | Categoría | Write-up |
| :--- | :--- | :--- | :--- |
| __Take over__ | 🟢 Fácil | Web/Linux | [Ver guía](./take_over) |
| __c0lddbox easy__ | 🟢 Fácil | Web/Linux | [Ver guía](./c0lddbox%20easy) |
| __DAV__ | 🟢 Fácil | Web/Linux | [Ver guía](./DAV) |
| __Brute It__ | 🟢 Fácil | (Web/Fuerza Bruta/Cracking)/Linux | [Ver guía](./Brute%20It) |
| __Bounty Hacker__ | 🟢 Fácil | (Web/Fuerza Bruta/FTP)/Linux | [Ver guía](./Bounty%20Hacker) |
| __Team__ | 🟢 Fácil | (Web/Fuzzing/LXD)/Linux | [Ver guía](./Team) |
| __StartUp__ | 🟢 Fácil | (Web/FTP)/Linux | [Ver guía](./StartUp) |
| __Break Out The Cage__ | 🟢 Fácil | (Web/FTP/Espetrografía/Vigènere)/Linux | [Ver guía](./Break%20Out%20The%20Cage) |
| __Fools Mate__ | 🟢 Fácil | Web/JS/HTTP | [Ver guía](./Fools%20Mate) |
| __VunNet: Internal__ | 🟢 Fácil / 🟡 Intermedio | (SAMBA/NFS/Redis/rsync)/Linux | [Ver guía](./VulnNet:%20Internal) |
| __Mr Robot__ | 🟡 Intermedio | Web/Linux | [Ver guía](./Mr%20Robot) |
| __Wonderland__ | 🟡 Intermedio | Web/Linux | [Ver guía](./Wonderland) |
| __Develpy__ | 🟡 Intermedio | (***Python***/Web)/Linux | [Ver guía](./Develpy) |
| __Biohazard__ | 🟡 Intermedio | Web/Linux | [Ver guía](./Biohazard) |
| __Cooctus Stories__ | 🟡 Intermedio | (RPC/Web/Python/C/GIT)/Linux | [Ver guía](./Cooctus%20Stories) |
| __ContainMe__ | 🟡 Intermedio | (Web/LFI/RCE/IntraNet/MySQL)/Linux | [Ver guía](./ContainMe) |
| __Chronicle__ | 🟡 Intermedio | (Web/JS/API/Caché/Buffer Overflow)/Linux | [Ver guía](./Chronicle) |
| __ConvertMyVideo__ | 🟡 Intermedio | (Web/youtube-dl/SSRF/RCE/Cronjob)/Linux | [Ver guía](./ConvertMyVideo) |
| __Smol__ | 🟡 Intermedio | (Web/WordPress/LFI/MySQL/PasswdCracking/PAM)/Linux | [Ver guía](./Smol) |
| __Infinity Pool__ | 🟡 Intermedio | (Web/RCE/Internal Services/FreePBX)/Linux | [Ver guía](./Infinity%20Pool) |

## 🛠️ Metodología Utilizada

Para estas salas, suelo seguir un flujo de trabajo estándar de hacking ético:

__Reconocimiento:__ Escaneo de puertos con `nmap` y enumeración de directorios con `gobuster` o `ffuf`.

__Análisis de Vulnerabilidades:__ Identificación de versiones de software desactualizadas o configuraciones erróneas.

__Explotación:__ Uso de exploits públicos, fuerza bruta o manipulación de parámetros.

__Post-Explotación:__ Recolección de información local y búsqueda de vectores para `root` o `Administrator`.

---

>[!TIP]
>Si estás empezando en THM, te recomiendo mucho las salas de "_Pre-Security_" y "_Complete Beginner_" para asentar las bases.
