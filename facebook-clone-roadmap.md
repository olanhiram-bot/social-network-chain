# Facebook Clone Roadmap

## Prioridad 1: Realtime

- [x] Realtime base con SSE autenticado.
- [x] Eventos realtime para feed.
- [x] Eventos realtime para notificaciones.
- [x] Eventos realtime para Messenger.
- [ ] WebSockets bidireccionales para presencia/typing.
- [ ] WebSockets para comentarios y reacciones.
- [ ] WebSockets para Messenger.
- [ ] WebSockets para lives.
- [ ] Reemplazar polling donde ya exista evento realtime estable.

## Prioridad 2: Messenger

- [x] Conversaciones 1 a 1.
- [x] Mensajes firmados con app signer.
- [x] Notificacion por mensaje nuevo.
- [ ] Visto/no visto.
- [ ] Indicador escribiendo.
- [ ] Adjuntos: imagen, video, audio.
- [ ] Chats grupales.
- [ ] Busqueda dentro de chats.

## Prioridad 3: Lives

- [x] Crear live.
- [x] Chat en live.
- [x] Replay guardado.
- [x] Preview visible para otros usuarios por snapshots.
- [ ] WebRTC o proveedor streaming real.
- [ ] Espectadores en vivo.
- [ ] Chat sincronizado con replay.
- [ ] Lives como pagina.

## Prioridad 4: Grupos

- [x] Crear grupo.
- [x] Unirse/salir.
- [x] Publicar dentro del grupo.
- [x] Rol base: admin, miembro.
- [x] Privacidad base: publico, privado.
- [x] Feed de grupo.
- [ ] Moderadores.
- [ ] Invitaciones.
- [ ] Aprobacion para grupos privados.

## Prioridad 5: Notificaciones

- [x] Notificaciones persistentes.
- [x] Solicitud de amistad.
- [x] Solicitud aceptada.
- [x] Comentarios.
- [x] Reacciones.
- [x] Seguidores de pagina.
- [x] Mensajes directos.
- [x] Click en notificacion navega a post/perfil/pagina/chat.
- [ ] Agrupacion tipo "3 personas reaccionaron".
- [ ] Preferencias de notificaciones.
- [ ] Realtime sin polling.

## Prioridad 6: Paginas

- [x] Crear pagina.
- [x] Vista publica de pagina.
- [x] Seguir pagina.
- [x] Publicar como pagina.
- [x] Editar pagina desde UI.
- [ ] Roles: admin, editor, moderador.
- [ ] Historias como pagina.
- [ ] Lives como pagina.
- [ ] Estadisticas.
- [ ] Boton contacto, sitio web, ubicacion.
- [ ] Posts fijados.

## Prioridad 7: Perfil

- [x] Vista de perfil.
- [x] Posts del usuario.
- [x] Lives del usuario.
- [x] Editar datos basicos.
- [x] Fotos.
- [x] Videos.
- [x] Amigos.
- [ ] Likes.
- [x] Paginas.
- [x] Grupos.
- [ ] Privacidad por campo.
- [x] Timeline filtrado.

## Prioridad 8: Comentarios

- [x] Crear comentarios.
- [x] Mostrar comentarios.
- [ ] Respuestas anidadas.
- [ ] Reacciones en comentarios.
- [ ] Ordenamiento.
- [ ] Ver mas comentarios.
- [x] Editar/eliminar comentarios propios.

## Prioridad 9: Compartir

- [x] Compartir en perfil.
- [x] Compartir en pagina.
- [x] Compartir por Messenger.
- [x] Quote/share con texto.
- [x] Contador de compartidos.

## Prioridad 10: Busqueda

- [x] Busqueda global.
- [x] Personas.
- [x] Paginas.
- [x] Grupos.
- [x] Posts.
- [x] Lives.
- [x] Historial de busqueda.

## Prioridad 11: Marketplace

- [x] Productos.
- [x] Categorias.
- [x] Fotos.
- [x] Precio.
- [x] Ubicacion.
- [x] Chat con vendedor.

## Prioridad 12: Eventos

- [x] Crear evento.
- [x] Asistir/interesado.
- [x] Invitar amigos.
- [x] Eventos de paginas.
- [x] Eventos de grupos.

## Prioridad 13: Privacidad y seguridad

- [x] Bloquear usuarios.
- [x] Reportar contenido.
- [x] Audiencia por post: publico, amigos, solo yo.
- [x] Moderacion.
- [x] Soft delete.

## Prioridad 14: UX

- [ ] Sidebar completa.
- [ ] Menu de usuario.
- [ ] Modales de media.
- [ ] Visor de fotos/videos.
- [ ] Skeleton loading.
- [ ] Empty states completos.
- [ ] Mobile pulido.

## Prioridad 15: Infraestructura

- [ ] Storage externo para media.
- [ ] WebSocket gateway.
- [ ] Jobs/colas.
- [ ] Paginacion en feed.
- [ ] Indices y busqueda.
- [ ] Tests e2e.
