# 🎯 HackTheBox Write-ups

En este apartado documento mi paso por la plataforma TryHackMe, detallando la resolución de máquinas, retos de redes y rutas de aprendizaje (_Learning Paths_).

## 📊 Resumen de Actividad
- __Enfoque:__ Enumeración de red, explotación de servicios web y escalada de privilegios en Linux/Windows.

## 📂 Contenido del Directorio

Las resoluciones están organizadas por el nombre de la sala o máquina:

| Sala/Máquina | Dificultad | Categoría | Write-up |
| :--- | :--- | :--- | :--- |
| __Fireflow__ | 🟡 Intermedio | (Web/Langflow/API/JWT/MCP/JSON-RPC/Kubernetes/WebSockets)/Linux | [Ver guía](./Fireflow) |


## 🛠️ Metodología Utilizada

Para estas salas, suelo seguir un flujo de trabajo estándar de hacking ético:

__Reconocimiento:__ Escaneo de puertos con `nmap` y enumeración de directorios con `gobuster` o `ffuf`.

__Análisis de Vulnerabilidades:__ Identificación de versiones de software desactualizadas o configuraciones erróneas.

__Explotación:__ Uso de exploits públicos, fuerza bruta o manipulación de parámetros.

__Post-Explotación:__ Recolección de información local y búsqueda de vectores para `root` o `Administrator`.
