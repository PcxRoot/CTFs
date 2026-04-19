# 🚩 PicoCTF
En este apartado documento mi progreso en picoCTF, la plataforma de seguridad informática de la Universidad Carnegie Mellon. 
Aquí detallo la resolución de retos tipo Capture The Flag (CTF) que abarcan desde criptografía hasta ingeniería inversa.

## 📊 Resumen de Actividad
**Perfil de picoCTF:** ***pcxroot***
**Enfoque:** Resolución de retos modulares, análisis de binarios, criptografía avanzada y técnicas de esteganografía.

## 📂 Contenido del Directorio
Los retos están organizados por categorías y niveles de dificultad (basado en el año/edición del evento):
| Sala/Máquina | Dificultad | Categoría | Write-up |
| :---: | :---: | :---: | :---: |
| __Crack The Gate 2__ | 🟡 Intermedio | Web Exploitation / Rate Limit bypass | [Ver guía](./Crack%20The%20Gate%202) |

## 🛠️ Metodología Utilizada
A diferencia de las máquinas de THM, para picoCTF mi flujo de trabajo se divide por dominios específicos:
***Análisis Inicial:*** Lectura detallada del enunciado y descarga de los archivos adjuntos (si los hay). Identificación del formato de la flag: picoCTF{...}.
- ***Web:*** Uso de Burp Suite e inspección de código fuente.
- ***Forensics:*** Uso de exiftool, binwalk, steghide y strings.
- ***Crypto:*** Análisis de cifrados con CyberChef o scripts en Python.
- ***Reversing/Pwn:*** Desensamblado con Ghidra o depuración con GDB/pwndbg.
***Scripting:*** Automatización de procesos mediante Python para ataques de fuerza bruta local o manipulación de datos a nivel de bit.
***Captura de Flag:*** Localización y descifrado de la cadena final para validar el reto.

>[!TIP]
>Si te quedas atascado en algún reto de criptografía, recuerda que la mayoría de los retos de nivel básico suelen utilizar rotaciones (***ROT13***) o ***Base64***.
>¡No olvides revisar siempre las pistas del reto!
