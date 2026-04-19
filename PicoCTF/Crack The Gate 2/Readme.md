# 📚 Contexto

Este reto consiste en un panel de login web que debemos vulnerar realizando un ataque de fuerza bruta usando las contraseñas que nos da el mismo laboratorio. No obstante, el servicio web implementa un ***Rate Limit*** que por cada contraseña incorrecta debemos esperar 20 minutos para volver a intentarlo.

Esta es la información de interés que tenemos sobre el reto:
- ***Email:*** `ctf-player@picoctf.org`
- ***Contraseñas:*** Se nos da un diccionario con $19$ posibles contraseñas.

Como el servicio web tan solo nos permite probar una contraseña cada 20 minutos, el peor de los casos tardaríamos unos $360$ minutos o $6$ horas. Este caso es un ejemplo de ***Rate Limit*** muy extenso, pero nos sirve para comprender que, aun así, si no esta bien implementado, es posible *bypasear* esta implementación. 

Para resolver este reto necesitaremos hacer uso de ***Burp Suite***, un navegador web (opcional) y ***Python*** con la librería `requests`.
# 🕵️Reconocimiento

Antes de cualquier actividad de ***Hacking Ético*** es imprescindible realizar una fase de reconocimiento mediante el cual obtendremos una idea de como funciona el flujo de datos.

Cuando interceptamos la petición `POST` al enviar la primera contraseña observamos que la petición completa se realiza de esta forma:
```HTTP
POST /login HTTP1.1
<snap>

{
  "eamil":"ctf-player@picoctf.org",
  "password":"Contraseña"
}
```

Y se nos devuelve esta respuesta del servidor:
```HTTP
HTTP1.1 429 Too Many Requests
<snap>

{
  "success":false,
  "error":"Too many failed attempts. Please try again in 20 minutes."
}
```

>En el caso de que no te salga la clave-valor `"error"` manda una nueva petición.

Si queremos seguir probando debemos de esperar 20 minutos hasta que el servidor desbanee nuestra IP y podemos realizar una nueva petición (obviamente no vamos a hacerlo).
# 💣Explotación
## ✒️Explicación

En el tráfico moderno, es común que nuestra petición no llegue directamente al servidor final, sino que pase por ***proxies, balanceadores de carga*** o ***CDNs*** (como Cloudflare).

Cuando esto ocurre el servidor final solo ve la dirección IP del proxy, no la de nuestra PC. Para solucionar esto y que el servidor sepa quién hizo la petición originalmente, se inventó la cabecera `X-Forwarded-For`.
### Estructura de la cabecera

La cabecera sigue este formato:
```
X-Forwarded-For: <IP_del_cliente>, <proxy_1>, <proxy_2>
```

- ***IP del cliente:*** La dirección IP original del usuario.
- ***Proxies:*** Una lista de las direcciones IP de los nodos por los que ha pasado la petición.
### Vulnerabilidad

Muchos desarrolladores cometen el error de usar esta cabecera para:
1. ***Verificar identidades:*** "*Si la IP es de la oficina (`1.2.3.4`), déjalo entrar sin contraseña*".
2. ***Gestionar el Rate Limit:*** "*Si esta IP falla 5 veces, bloquéala*".

Esto es peligroso porque las cabeceras HTTP son enviadas por el cliente y ***pueden ser manipuladas***. Si el servidor no está configurado para confiar únicamente en proxies conocidos, un atacante puede inyectar su propia cabecera ***XFF***.

>[!caution]
>Si el servidor confía ciegamente en `X-Forwarded-For`, un atacante puede "*hacerse pasar*" por cualquier IP simplemente editando la petición con herramientas como ***Burp Suite*** o ***Python***.
### 💥Exploit

Para explotar la vulnerabilidad creamos un script en ***Python*** que añada estas cabeceras `X-Forwarded-For` para engañar al servidor y que este vea diferentes IPs.

[Ver exploit](./script.py)
