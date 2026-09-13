import { Solicitante } from '../../domain/entities/solicitante.entity';
import { SolicitudPrestamo } from '../../domain/entities/solicitud-prestamo.entity';
import { SolicitanteNoEncontradoError } from '../../domain/errors/solicitante-no-encontrado.error';
import { ClockPort } from '../../domain/ports/clock.port';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { SolicitudPrestamoRepository } from '../../domain/repositories/solicitud-prestamo.repository';
import { FechaCivil } from '../../domain/value-objects/fecha-civil';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';

/**
 * Lo que todo caso de uso del registro necesita antes de empezar a trabajar.
 */
export interface ContextoDelRegistro {
  /** Día civil actual en la zona del TECNM, derivado del `ClockPort` (RN-04). */
  readonly hoy: FechaCivil;
  readonly solicitante: Solicitante;
  /** Registro del año en curso; vacío si el usuario aún no ha solicitado nada (RN-06). */
  readonly solicitud: SolicitudPrestamo;
}

/**
 * Carga el contexto de trabajo de los casos de uso del registro.
 *
 * ## Por qué existe
 *
 * Ocho casos de uso —cuatro comandos y cuatro consultas— empezaban con las
 * mismas cinco líneas: convertir el identificador, resolver el día de hoy,
 * cargar al solicitante, fallar si no existe y cargar el registro del año
 * creándolo vacío si hacía falta. Repetido ocho veces, ese preámbulo deja de ser
 * "orquestación trivial" y pasa a ser una decisión duplicada: que el registro
 * sea **por usuario y año** (RN-06) y que se **cree al vuelo** en la primera
 * solicitud estaba escrito en ocho sitios que había que cambiar a la vez.
 *
 * Aquí está escrito una vez. Los handlers quedan con una sola dependencia y con
 * lo único que los distingue: qué le piden al dominio.
 *
 * ## Qué NO hace
 *
 * No decide la política ni valida nada del negocio: sólo reúne las piezas. La
 * política la pide cada handler al `Solicitante`, porque los de escritura la
 * necesitan definida (y fallan si no, EC-06) mientras que los de calendario
 * toleran que aún no lo esté.
 *
 * Los casos de uso que sólo tocan al solicitante —capturar y actualizar el
 * sueldo base, el perfil, el login— **no lo usan**: no tienen registro que
 * cargar, y hacerles depender de esto les daría un reloj y un repositorio de
 * solicitudes que no necesitan (segregación de interfaces, CLAUDE.md §5-I).
 */
export class CargadorDelRegistro {
  constructor(
    private readonly clock: ClockPort,
    private readonly solicitantes: SolicitanteRepository,
    private readonly solicitudes: SolicitudPrestamoRepository,
  ) {}

  /**
   * @param solicitanteIdCrudo Identificador tal como llega del comando o la
   *   consulta, es decir, tal como venía del token.
   * @throws {SolicitanteIdInvalidoError} si el identificador está vacío.
   * @throws {SolicitanteNoEncontradoError} si no existe el solicitante.
   */
  async cargar(solicitanteIdCrudo: string): Promise<ContextoDelRegistro> {
    const hoy = FechaCivil.desdeInstante(this.clock.now());
    const solicitanteId = SolicitanteId.de(solicitanteIdCrudo);

    const solicitante = await this.solicitantes.buscarPorId(solicitanteId);
    if (solicitante === null) {
      throw new SolicitanteNoEncontradoError(solicitanteId.valor);
    }

    const solicitud =
      (await this.solicitudes.buscarPorSolicitanteYAnio(solicitanteId, hoy.anio)) ??
      SolicitudPrestamo.crearVacia(solicitanteId, hoy.anio);

    return { hoy, solicitante, solicitud };
  }
}
