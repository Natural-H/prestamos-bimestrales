export { DomainError } from './domain.error';

/* Integridad de los value objects */
export { MontoInvalidoError } from './monto-invalido.error';
export { PorcentajeInvalidoError } from './porcentaje-invalido.error';
export { FechaInvalidaError } from './fecha-invalida.error';
export { PeriodoInvalidoError } from './periodo-invalido.error';
export { SueldoBaseInvalidoError } from './sueldo-base-invalido.error';
export { TipoUsuarioInvalidoError } from './tipo-usuario-invalido.error';
export { SolicitanteIdInvalidoError } from './solicitante-id-invalido.error';

/* Calendario y disponibilidad */
export { BimestreInexistenteError } from './bimestre-inexistente.error';
export { BimestreBloqueadoError } from './bimestre-bloqueado.error';
export { PeriodoSolicitudCerradoError } from './periodo-solicitud-cerrado.error';
export { PeriodoDiciembreCerradoError } from './periodo-diciembre-cerrado.error';

/* Política de préstamo por tipo de usuario */
export { MontoExcedeLimiteError } from './monto-excede-limite.error';
export { MontoMenorAlMinimoError } from './monto-menor-al-minimo.error';
export { MontoRequeridoError } from './monto-requerido.error';
export { MontoNoCapturableError } from './monto-no-capturable.error';
export { DiciembreExclusivoTrabajadoresError } from './diciembre-exclusivo-trabajadores.error';
export { SueldoBaseNoRegistradoError } from './sueldo-base-no-registrado.error';

/* Registro de solicitud (agregado) */
export { PeriodoDeOtroAnioError } from './periodo-de-otro-anio.error';
export { PeriodoYaSolicitadoConOtroMontoError } from './periodo-ya-solicitado-con-otro-monto.error';

/* Solicitante y sueldo base */
export { SolicitanteNoEncontradoError } from './solicitante-no-encontrado.error';
export { SueldoBaseYaRegistradoError } from './sueldo-base-ya-registrado.error';
export { SueldoBaseSoloTrabajadoresError } from './sueldo-base-solo-trabajadores.error';

/* Persistencia (contrato de los puertos) */
export { ConflictoDeConcurrenciaError } from './conflicto-de-concurrencia.error';
