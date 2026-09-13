/**
 * Arranque de las pruebas.
 *
 * `reflect-metadata` es lo que hace funcionar los decoradores de
 * `class-validator` y `class-transformer` en los DTOs de presentación. Sólo lo
 * necesitan las pruebas de esa capa: el dominio y la aplicación no usan
 * decoradores porque no dependen de ningún framework.
 */
import 'reflect-metadata';
