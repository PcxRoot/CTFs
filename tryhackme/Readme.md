# 🎯 TryHackMe Write-ups

En este apartado documento mi paso por la plataforma TryHackMe, detallando la resolución de máquinas, retos de redes y rutas de aprendizaje (_Learning Paths_).

## 📊 Resumen de Actividad
- __Perfil de THM:__ Calvinh0
- __Enfoque:__ Enumeración de red, explotación de servicios web y escalada de privilegios en Linux/Windows.

## 📂 Contenido del Directorio

Las resoluciones están organizadas por el nombre de la sala o máquina:

| Sala/Máquina | Dificultad | Categoría | Write-up |
| :--- | :--- | :--- | :--- |
| __Take over__ | 🟢 Fácil | Web/Linux | [Ver guía](./take_over) |
| __c0lddbox easy__ | 🟢 Fácil | Web/Linux | [Ver guía](./c0lddbox%20easy) |
| __Mr Robot__ | 🟡 Intermedio | Web/Linux | [Ver guía](./Mr%20Robot) | 

## 🛠️ Metodología Utilizada

Para estas salas, suelo seguir un flujo de trabajo estándar de hacking ético:

__Reconocimiento:__ Escaneo de puertos con `nmap` y enumeración de directorios con `gobuster` o `ffuf`.

__Análisis de Vulnerabilidades:__ Identificación de versiones de software desactualizadas o configuraciones erróneas.

__Explotación:__ Uso de exploits públicos, fuerza bruta o manipulación de parámetros.

__Post-Explotación:__ Recolección de información local y búsqueda de vectores para `root` o `Administrator`.

---

>[!TIP]
>Si estás empezando en THM, te recomiendo mucho las salas de "Pre-Security" y "Complete Beginner" para asentar las bases.
