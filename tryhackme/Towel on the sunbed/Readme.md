# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS --min-rate 5000 -vvv $IP

PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 62
3000/tcp open  ppp     syn-ack ttl 62
```

```bash
sudo nmap -p22,3000 -Pn -n -sVC --min-rate 5000 -v -oN versiones $IP

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 90:a2:90:95:81:e8:36:5e:cf:bd:f9:3a:aa:d1:07:88 (ECDSA)
|_  256 a2:a7:34:5a:6c:44:b3:f0:ac:75:0c:52:f8:12:40:b3 (ED25519)
3000/tcp open  http    Node.js Express framework
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
| http-title: Ponzi Portfolio \xE2\x80\x94 Login
|_Requested resource was /auth/login
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno web

Cuando accedemos a la aplicación web desde nuestro navegador, se nos redirige al *endpoint* `/auth/login`. Cuando accedo a un panel de login, me gusta probar algunos *payloads* sencillos de ***SQL Injection*** para ver si nos devuelve algún tipo de error de SQL.

```
Username: admin'--
Password: test

Username: admin' OR 1=1 --
Password: test

...
```

>No conseguimos ninguna respuesta interesante del servidor, y al no tener ningún nombre de usuario, realizar fuerza bruta tampoco es una opción viable.

### <font color=red>[-]</font> Código fuente `/auth/login`

Si vemos el código fuente del *endpoint* `/auth/login` nos damos cuenta de que existe un código JavaScript que se ejecuta localmente en nuestro navegador. Para descargarlo podemos usar `curl`:

```bash
curl -s "http://$IP:3000/js/auth.js" --output login.js
```

Una vez tenemos el código en nuestro sistema, podemos analizarlo cómodamente con editores de texto enriquecido como ***VSCode*** o incluso herramientas de línea de comandos como `batcat`.

```js
function initAuthForm(formId, endpoint) {
    const form = document.getElementById(formId);
    const errorMsg = document.getElementById('error-msg');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorMsg.classList.add('hidden');

        const data = Object.fromEntries(new FormData(form));
        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await resp.json();
            if (!resp.ok) {
                errorMsg.textContent = json.error || 'An error occurred.';
                errorMsg.classList.remove('hidden');
                return;
            }
            window.location.href = json.redirect || '/dashboard';
        } catch (err) {
            errorMsg.textContent = 'Network error. Please try again.';
            errorMsg.classList.remove('hidden');
        }
    });
}
```

En este archivo JS que carga el *endpoint* `/auth/login` vemos la función encargada de realizar la petición ***HTTP POST*** de inicio de sesión, pero no encontramos ninguna vulnerabilidad en el código que podamos aprovechar.

### <font color=red>[-]</font> Registro

En la página de inicio de sesión en la que nos encontramos podemos ver un enlace a un nuevo *endpoint* `/auth/register`. Si entramos encontramos un nuevo formulario con el que podemos registrarnos en la app.

Utiliza el mismo código JavaScript que el *endpoint* anterior, tan solo que apunta a un *endpoint backend* diferente, por lo que no necesitamos volver a analizar el código JavaScript.

>[!important]
>*Como no podemos hacer más, es hora de registrarnos en la app. Sin embargo, a partir de aquí es bueno tener un seguimiento de lo que vamos haciendo, con sus peticiones y respuestas HTTP.*
>
>*Por lo que abriremos **Burp Suite** que nos permitirá realizar ese seguimiento para poder ver como se realiza la comunicación HTTP con el servidor.*

Una vez que tenemos ***Burp Suite*** abierto y el navegador configurado para usarlo como *proxy*, registramos una cuenta en la app.

```
Credenciales de ejemplo:

Username: hacker
Password: hacker
```

Si vemos la comunicación HTTP:

![[Pasted image 20260828112008.png]]

Vemos que se ha creado la cuenta correctamente y se nos redirige al *endpoint* `/dashboard`.

### <font color=red>[-]</font> `/dashboard`

>La app parece ser algún tipo de *bróker* de criptomonedas.

Si navegamos por la página como haría un usuario normal vemos que existe una funcionalidad de "***Reclamar Recompensa***". La descripción de dicha funcionalidad dice:

```
Gana 50 PONZI cada 24 horas reclamando tu recompensa de staking.

La recompensa estaá disponible para reclamar ahora.
```

Justo debajo encontramos otra sección llamada "***Whale Vault***" (que vendría a ser algo como *Caja Fuerte de Ballenas*).

>*En el mundo cripto, **Whale** se refiere a una persona, institución o entidad que posee una cantidad tan grande de una criptomoneda que sus operaciones de compra o venta pueden **mover el precio** del activo y alterar la liquidez del mercado.*

Además, la descripción dice que si conseguimos `150 PONZI` desbloquearemos esta caja fuerte y obtendremos una recompensa exclusiva.

#### <font color=red>[@]</font> Código fuente `/dashboard`

Si vemos el código fuente de la página, encontramos que de nuevo carga un código JavaScript que no hemos visto hasta ahora. Podemos volver a descargarlo usando `curl` de la misma forma que antes:

```JS
const WHALE_THRESHOLD = 150;

let countdownTimer = null;

async function loadDashboard() {
    const resp = await fetch('/dashboard/api/me');
    if (resp.status === 401) {
        window.location.href = '/auth/login';
        return;
    }
    const data = await resp.json();

    document.getElementById('nav-username').textContent = data.username;
    document.getElementById('balance').textContent = data.balance.toLocaleString(undefined, { maximumFractionDigits: 2 });

    const tierBadge = document.getElementById('tier-badge');
    tierBadge.textContent = data.tier;
    tierBadge.className = 'tier-badge ' + data.tier.toLowerCase();

    const tbody = document.querySelector('#prices-table tbody');
    tbody.innerHTML = '';
    for (const p of data.prices) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.symbol}</td><td class="price-val">$${p.price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`;
        tbody.appendChild(tr);
    }

    const claimBtn = document.getElementById('claim-btn');
    const claimStatus = document.getElementById('claim-status');
    if (countdownTimer) clearInterval(countdownTimer);

    if (data.canClaim) {
        claimBtn.disabled = false;
        claimStatus.textContent = 'Reward is available to claim now.';
    } else {
        claimBtn.disabled = true;
        let remaining = data.secondsUntilClaim;
        function updateCountdown() {
            const h = Math.floor(remaining / 3600);
            const m = Math.floor((remaining % 3600) / 60);
            const s = remaining % 60;
            claimStatus.textContent = `Next claim in: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            if (remaining <= 0) {
                clearInterval(countdownTimer);
                claimBtn.disabled = false;
                claimStatus.textContent = 'Reward is available to claim now.';
            }
            remaining--;
        }
        updateCountdown();
        countdownTimer = setInterval(updateCountdown, 1000);
    }

    const pct = Math.min(100, (data.balance / WHALE_THRESHOLD) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent =
        `${data.balance.toLocaleString()} / ${WHALE_THRESHOLD.toLocaleString()} PONZI`;

    const vaultBtn = document.getElementById('vault-btn');
    vaultBtn.disabled = data.balance < WHALE_THRESHOLD;
}

document.getElementById('claim-btn').addEventListener('click', async () => {
    const btn = document.getElementById('claim-btn');
    btn.disabled = true;
    const status = document.getElementById('claim-status');
    try {
        const resp = await fetch('/claim', { method: 'POST' });
        const json = await resp.json();
        if (resp.ok) {
            status.textContent = `Claimed! +${json.reward} PONZI. PONZI price: $${json.priceSnapshot}`;
            await loadDashboard();
        } else {
            status.textContent = json.error || 'Claim failed.';
            btn.disabled = false;
        }
    } catch (e) {
        status.textContent = 'Network error.';
        btn.disabled = false;
    }
});

document.getElementById('vault-btn').addEventListener('click', async () => {
    const result = document.getElementById('vault-result');
    result.classList.add('hidden');
    try {
        const resp = await fetch('/vault');
        const json = await resp.json();
        if (resp.ok) {
            result.textContent = json.flag;
            result.classList.remove('hidden');
        } else {
            result.textContent = json.error || 'Vault locked.';
            result.style.borderColor = 'var(--red)';
            result.style.color = 'var(--red)';
            result.style.background = 'rgba(248,81,73,0.08)';
            result.classList.remove('hidden');
        }
    } catch (e) {
        result.textContent = 'Network error.';
        result.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/auth/login';
});

loadDashboard();
```

En este código JS vemos como se ejecutan todas las funcionalidades de la página. Una de las funcionalidades más relevantes para nosotros se encuentra en el botón `vault-btn`, con el cual si lo clicamos realizamos una petición HTTP hacia el *endpoint* `/vault` en la que puede estar la *flag* necesaria para pasar el CTF.

Para ver la respuesta del servidor podemos realizar la petición desde `curl`, para ello:

1. Necesitamos obtener las cookies de sesión, por lo que volvemos a iniciar sesión con nuestra cuenta, esta vez usando `curl`:
   ```bash
   curl -s -X POST "http://$IP:3000/auth/login" -H "Content-Type: application/json" -d '{"username":"hacker","password":"hacker"}' -c cookies.txt
   ```
   
   >Ahora tendremos las cookies en un archivo `cookies.txt` en nuestro directorio actual.

2. Una vez tengamos las cookies de nuestra sesión, podemos realizar la petición HTTP al *endpoint* `/vault`:
   ```bash
   curl -s "http://$IP:3000/vault" -b cookies.txt
   
   {
  "error": "Access denied. Whale-tier balance required.",
  "currentBalance": 0,
  "required": 150,
  "shortfall": 150
}
   ```
   
   Vemos que nos devuelve un error que nos detalla que no pertenecemos al *Whale-tier*, ya que tenemos un balance de `0` cuando es necesario `150`.

Si seguimos el código JavaScript, veremos que no podemos realizara acciones en el *backend* a través de lo que podemos manipular desde el *Frontend*. Por lo que no encontramos ningún vector de ataque.

#### <font color=red>[@]</font> Reclamar premio

Tras todos este reconocimiento del que hemos sacad una visión bastante clara de como funciona la app, es hora de interactuar con las funcionalidades de la página.

La más importante es la de ***Abrir la caja fuerte de las ballenas***, pero ya hemos visto que no vamos a ser capaces de obtener nada más hasta que no obtengamos los `150 PONZI`.

La siguiente en prioridad, por lo tanto, es la funcionalidad de reclamar premio, la cual nos da `50 PONZI` cada 24 horas. Si reclamamos el premio vemos que a nuestro balance se han sumado `50 PONZI` y ahora debemos esperar (*obviamente no vamos a hacerlo*).

Si revisamos las peticiones HTTP realizadas hasta ahora en nuestro *Burp Suite*, veremos que al reclamar la recompensa se hace una petición ***HTTP POST*** al *endpoint* `/claim`. Ahora nuestro botón está deshabilitado en la página web, no obstante esta funcionalidad se encuentra en el *frontend*, por lo que podemos habilitarla de nuevo si eliminamos el atributo `disabled` del elemento `button` con `id="claim-btn"`.

![[Pasted image 20260828115931.png]]

Al eliminar dicho atributo podremos volver a presionar el botón, pero se nos mostrará un mensaje que dice: `La recompensa ya ha sido reclamada`. Podemos ver la respuesta del *backend* usando de nuevo `curl` o las herramientas de desarrollador del navegador.

![[Pasted image 20260828120226.png]]

>Parece que la validación se hace en el *backend* a través de nuestra cuenta y no en el *frontend*, por lo que no vamos a conseguir engañar al servidor para que nos deje repetir reclamar la recompensa.

### <font color=red>[!]</font> Vulnerabilidad *Race Condition (CWE-362)*

>[!important]
>*Cuando veamos funcionalidades las cuales tan solo podemos realizar una vez (como canjear un código de descuento o reclamar una recompensa), la vulnerabilidad principal es* ***Race Condition***
>
>***[Explicación](#vulnerabilidad-race-condition)***
>

La idea es aprovechar la ventana de tiempo entre que el servidor procesa la petición de reclamación del premio en la base de datos y el tiempo que tarda en bloquearnos la acción. No obstante, como ya reclamamos el premio para saber como se procesaba, necesitaremos crear una nueva cuenta para poder hacer uso de la funcionalidad de nuevo.

Para ello, salimos de la sesión actual y registramos una nueva cuenta (por ejemplo: `Username: hacker2&Password: hacker2`). Una vez dentro de la nueva cuenta, podremos volver a hacer uso de la funcionalidad de *Reclamar recompensa* pero ***AHORA NO LA TOMAREMOS***.

Dentro de nuestro *Burp Suite*, buscamos la petición POST de cuando reclamamos la recompensa con la cuenta anterior.

![[Pasted image 20260829204604.png]]

Una vez la hayamos dectado, la enviamos al *Repeater de Burp Suite* con la combinación de teclas `CTRL+R`.

![[Pasted image 20260829204730.png]]

Una vez tengamos la petición en el *Repeater*, debemos de cambiar la cookie de sesión (*ya que recordemos que esta petición se realizó con la primera cuenta, la cual ya está bloqueada hasta dentro de 24 horas*). Para ello tomaremos la cookie de sesión de la nueva cuenta, ya sea desde las herramientas de desarrollador en el navegador, o de alguna de las peticiones HTTP que ya hemos realizado con la segunda cuenta y que podemos ver a través del Proxy *Burp Suite*.

Cuando hayamos cambiado la cookie de sesión por la de la nueva cuenta, debemos de crear un grupo de varias peticiones que mandaremos en paralelo al servidor. Podemos hacerlo enviando de nuevo al *Repeater* la misma petición que ya tenemos en él con `CTRL+R`.

![[Pasted image 20260829205221.png]]

>En esta ocasión he generado 15 peticiones en total.

Para crear el grupo debemos de hacer clic en el símbolo `+` tras la última petición t hacer clic en `New tab group`, seleccionamos la opción `Select all` y creamos el grupo:

![[Pasted image 20260829205359.png]]

![[Pasted image 20260829205501.png]]

![[Pasted image 20260829205521.png]]

Una vez tengamos el grupo, pulsaremos en el desplegable junto a `Send` y usaremos la opción `Send group in parallel (last-byte sync)`.

![[Pasted image 20260829205628.png]]

Tras esto enviaremos las peticiones y podremos ver en la respuesta de las distintas peticiones que se han aceptado y obtendremos varios PONZI:

```HTTP
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 114
ETag: W/"72-g6H2H1PgsoGhnKB1QToFtBu9Qb8"
Date: Sat, 29 Aug 2026 18:57:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"message":"Staking reward claimed successfully.","reward":50,"newBalance":650,"tier":"Whale","priceSnapshot":4.2}
```

Ahora tan solo deberemos de volver al navegador y recargar la página para que se nos muestre nuestro nuevo balance:

![[Pasted image 20260829205858.png]]

>Ahora podremos reclamar la recompensa de las ballenas y obtener la flag del CTF.

---

# Explicaciones

## <font color=red>[?]</font> Vulnerabilidad Race Condition

>Una ***condición de carrera (Race Condition)*** ocurre cuando un sistema depende de la secuencia o el tiempo de eventos concurrentes (hilos o procesos) para funcionar correctamente, y dos o más operaciones acceden e intentan modificar un recurso compartido al mismo tiempo sin la sincronización adecuada.

### El principio básico: TOCTOU

>La inmensa mayoría de las condiciones de carrera en aplicaciones web derivan del patrón ***TOCTOU** (Time-Of-Check Time-To-Use)*.

El servidor ejecuta dos acciones secuenciales:

1. ***Check (Comprobación):*** Verifica si se cumple una regla (por ejemplo: `El usuario ya cobró su recompensa diaria?` o `El saldo es mayor o igual al coste?`)
2. ***Use/Act (Acción):*** Aplica el cambio si la condición es válida (por ejemplo: `Añadir 50 puntos` y `Marcar como reclamado`).

El fallo de seguridad radica en la ***ventana de colisión*** (*race window*) que existe entre la comprobación y la actualización. Si se envían múltiples peticiones simultáneas, todas pueden pasar la fase de comprobación antes de que la primera complete la fase de actualización.

```
HILO 1: [ Check: Reclamado? (NO) ] ------> [ Suma 50 pts y Marca como reclamado ]
HILO 2:     [ Check: Reclamado? (NO)] ---> [ Suma 50 pts y Marca como reclamado ]
HILO 3:         [ Check: Reclamado? (NO)] -> [ Suma 50 pts y Marca como reclamado ]
```

```
Flujo normal (Secuencial):

[Check: ¿Reclamado? (NO)] ---> [Act: Sumar 50 pts & Marcar reclamado]
                                  │
[Check: ¿Reclamado? (SÍ)] <───────┘ (Bloqueado)



Flujo vulnerable (Concurrente / Race Condition):

Petición 1: ─── [Check: NO] ───────────────────> [Act: +50 pts]
Petición 2: ─────── [Check: NO] ───────────────> [Act: +50 pts]  <-- Ventana de colisión aprovechada
Petición 3: ─────────── [Check: NO] ───────────> [Act: +50 pts]
```

>*Resultado: Los 3 hilos pasan la validación y el usuario recibe 150 puntos en lugar de 50.*

Entre la lectura de la base de datos y su posterior escritura existe una pequeña ***ventana de tiempo (race window)***. Si un atacante envía múltiple peticiones idénticas en paralelo dentro de esa fracción de milisegundo, todas las peticiones pasarán la fase de *Check* antes de que la primera haya completado la fase de *Act*, permitiendo ejecutar una acción de un solo uso múltiples veces (***Limit Overrun***).

### Aplicación en el CTF

En este reto, el sistema restringe la entrada de puntos a 50 unidades por día, exigiendo 150 puntos para obtener la recompensa (*flag*). Debido a que la comprobación no es atómica ni cuenta con bloqueos a nivel de base de datos, el envío concurrente de la petición de *reclamar recompensa* (utilizando el envío en paralelo de *Burp Suite*) permite que el *backend* procese la recompensa tres o más veces en el mismo instante, alcanzando el umbral de puntos necesario en una sola transacción.

### Mitigaciones recomendadas

#### En la Base de datos

- ***Operaciones atómicas:*** Actualizar el estado y verificar la precondición en una única sentencia (ej. `UPDATE ... WHERE claimed = false`).
- ***Bloqueos transaccionales:*** Implementar transacciones de base de datos con bloqueo de lectura pesimista (`SELECT ... FOR UPDATE`).
- ***Restricciones únicas (`UNIQUE` constraints):*** Aplicar restricciones a nivel de tabla (ej. par único `usuario_id` + `fecha`) para que el propio motor de base de datos rechace por diseño cualquier inserción duplicada.

#### Idempotencia

>[!important]
>La ***idempotencia*** (*hacer que una operación ejecutada múltiples veces produzca el mismo resultado que si se ejecutará una sola vez*) es un principio de diseño clave para mitigar las condiciones de carrera, especialmente en arquitecturas distribuidas, APIs REST y pasarelas de pago.

Para que la idempotencia neutralice una condición de carrera, el *backend* debe garantizarle mediante un ***mecanismo atómico***:

- ***Idempotency Keys (Claves de idempotencia):*** El cliente (o el propio servidor) asocia la petición a un identificador único (ej. `user_id + reward_date`) o un token UUID único).
- ***Almacenamiento transaccional:*** Antes de procesar la lógica, el servidor intenta registrar esa clave en una base de datos o almacén rápido (como *Redis*) usando una operación atómica (como `SETNX` o una inserción con restricción `UNIQUE`).
- ***Comportamiento ante colisión:*** Si llegan 10 peticiones idénticas en paralelo:
  1. Solo la primera logra registrar la clave y ejecuta la suma de puntos.
  2. Las otras 9 detectan que la clave ya está registrada (o en proceso) y devuelven la misma respuesta sin volver a sumar puntos.
