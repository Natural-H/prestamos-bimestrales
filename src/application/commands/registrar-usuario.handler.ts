import { Solicitante } from '../../domain/entities/solicitante.entity';
import { CorreoYaRegistradoError } from '../../domain/errors/correo-ya-registrado.error';
import { SolicitanteRepository } from '../../domain/repositories/solicitante.repository';
import { SolicitanteId } from '../../domain/value-objects/solicitante-id';
import { tipoUsuarioDesde } from '../../domain/value-objects/tipo-usuario';
import { CredencialesPort } from '../ports/credenciales.port';
import { CommandHandler } from '../ports/handler';
import { IdGeneratorPort } from '../ports/id-generator.port';
import { PerfilReadModel } from '../queries/obtener-perfil.handler';
import { RegistrarUsuarioCommand } from './registrar-usuario.command';

/**
 * Caso de uso **Registrar usuario** (CU-A01).
 *
 * El identificador **no lo genera el dominio** ni lo asigna la base de datos
 * (CLAUDE.md §2.3): llega del `IdGeneratorPort`, cuyo adaptador vive en
 * infraestructura. Así el agregado se construye entero antes de tocar la
 * persistencia.
 *
 * El hash de la contraseña no aparece por ningún lado: lo encapsula el
 * `CredencialesPort` (CLAUDE.md §9).
 *
 * **Limitación conocida:** el alta escribe en dos puertos —solicitante y
 * credenciales— sin una transacción que los abarque. Con la implementación de
 * infraestructura, ambos viven en la misma base de datos y el adaptador puede
 * envolverlos; queda anotado para no darlo por resuelto.
 */
export class RegistrarUsuarioHandler implements CommandHandler<
  RegistrarUsuarioCommand,
  PerfilReadModel
> {
  constructor(
    private readonly idGenerator: IdGeneratorPort,
    private readonly solicitantes: SolicitanteRepository,
    private readonly credenciales: CredencialesPort,
  ) {}

  async execute(command: RegistrarUsuarioCommand): Promise<PerfilReadModel> {
    const correo = command.correo.trim().toLowerCase();

    if (await this.credenciales.existeCorreo(correo)) {
      throw new CorreoYaRegistradoError(correo);
    }

    // Valida el rol contra el dominio antes de escribir nada (RN-01).
    const tipoUsuario = tipoUsuarioDesde(command.tipoUsuario);
    const solicitanteId = SolicitanteId.de(this.idGenerator.generar());
    const solicitante = Solicitante.registrar(solicitanteId, tipoUsuario);

    await this.solicitantes.guardar(solicitante);
    await this.credenciales.registrar(solicitanteId, correo, command.contrasena);

    return {
      solicitanteId: solicitante.id.valor,
      tipoUsuario: solicitante.tipoUsuario,
      tieneSueldoBase: solicitante.tieneSueldoBase,
      tieneDerechoADiciembre: solicitante.esTrabajador,
    };
  }
}
