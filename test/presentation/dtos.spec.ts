import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SolicitarBimestresDto } from '../../src/presentation/dtos/solicitar-bimestres.dto';
import { SueldoBaseDto } from '../../src/presentation/dtos/sueldo-base.dto';
import { RegistrarUsuarioDto } from '../../src/presentation/dtos/auth.dto';
import { SolicitarBimestresMapper } from '../../src/presentation/mappers/solicitar-bimestres.mapper';

/** Valida como lo haría el `ValidationPipe` global: con `whitelist` y `transform`. */
const validar = <T extends object>(clase: new () => T, cuerpo: unknown): string[] => {
  const dto = plainToInstance(clase, cuerpo, { enableImplicitConversion: false });
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...(error.children ?? []).flatMap((hijo) => Object.values(hijo.constraints ?? {})),
    ...(error.children ?? []).flatMap((hijo) =>
      (hijo.children ?? []).flatMap((nieto) => Object.values(nieto.constraints ?? {})),
    ),
  ]);
};

describe('SolicitarBimestresDto', () => {
  it('acepta una petición bien formada de alumno', () => {
    expect(
      validar(SolicitarBimestresDto, {
        bimestres: [{ mesReferencia: 2, montoEnPesos: '3500.00' }],
      }),
    ).toEqual([]);
  });

  it('acepta una petición de trabajador, que no lleva monto', () => {
    expect(validar(SolicitarBimestresDto, { bimestres: [{ mesReferencia: 2 }] })).toEqual([]);
  });

  it('rechaza una lista vacía (EC-14)', () => {
    expect(validar(SolicitarBimestresDto, { bimestres: [] })).toContain(
      'Hay que indicar al menos un bimestre.',
    );
  });

  it('rechaza bimestres repetidos dentro de la misma petición (EC-14)', () => {
    expect(
      validar(SolicitarBimestresDto, {
        bimestres: [
          { mesReferencia: 2, montoEnPesos: '100.00' },
          { mesReferencia: 2, montoEnPesos: '200.00' },
        ],
      }),
    ).toContain('No se puede repetir el mismo bimestre dentro de la misma petición.');
  });

  it('rechaza montos que no son cantidades en pesos', () => {
    const errores = validar(SolicitarBimestresDto, {
      bimestres: [{ mesReferencia: 2, montoEnPesos: '100.999' }],
    });

    expect(errores.join(' ')).toContain('hasta dos decimales');
  });

  describe('la validación de forma NO duplica reglas de negocio (CLAUDE.md §7.6)', () => {
    it('acepta un mes que no es bimestre: eso lo decide el dominio (RN-02)', () => {
      // Marzo pasa el DTO y lo rechaza el dominio con BimestreInexistenteError (400).
      expect(validar(SolicitarBimestresDto, { bimestres: [{ mesReferencia: 3 }] })).toEqual([]);
    });

    it('acepta un monto por encima del tope: eso lo decide la política del alumno (RN-09)', () => {
      expect(
        validar(SolicitarBimestresDto, {
          bimestres: [{ mesReferencia: 2, montoEnPesos: '99999.00' }],
        }),
      ).toEqual([]);
    });

    it('sí rechaza lo que ni siquiera es un mes del calendario', () => {
      expect(validar(SolicitarBimestresDto, { bimestres: [{ mesReferencia: 13 }] })).not.toEqual(
        [],
      );
      expect(validar(SolicitarBimestresDto, { bimestres: [{ mesReferencia: 2.5 }] })).not.toEqual(
        [],
      );
    });
  });
});

describe('SolicitarBimestresMapper', () => {
  it('toma el solicitante del token y traduce el monto ausente a null explícito', () => {
    const dto = plainToInstance(SolicitarBimestresDto, {
      bimestres: [{ mesReferencia: 2 }, { mesReferencia: 4, montoEnPesos: '100.00' }],
    });

    const comando = SolicitarBimestresMapper.aComando('usuario-del-token', dto);

    expect(comando.solicitanteId).toBe('usuario-del-token');
    expect(comando.bimestres).toEqual([
      { mesReferencia: 2, montoEnPesos: null },
      { mesReferencia: 4, montoEnPesos: '100.00' },
    ]);
  });
});

describe('SueldoBaseDto', () => {
  it('acepta una cantidad en pesos como cadena', () => {
    expect(validar(SueldoBaseDto, { sueldoBaseEnPesos: '12345.67' })).toEqual([]);
  });

  it('rechaza más de dos decimales', () => {
    expect(validar(SueldoBaseDto, { sueldoBaseEnPesos: '12345.678' })).not.toEqual([]);
  });

  it('acepta el cero: que el sueldo deba ser positivo es del dominio (RN-13)', () => {
    expect(validar(SueldoBaseDto, { sueldoBaseEnPesos: '0.00' })).toEqual([]);
  });
});

describe('RegistrarUsuarioDto', () => {
  it('acepta un alta válida', () => {
    expect(
      validar(RegistrarUsuarioDto, {
        correo: 'alumno@tecnm.mx',
        contrasena: 'contrasena-larga',
        tipoUsuario: 'alumno',
      }),
    ).toEqual([]);
  });

  it('rechaza un rol inexistente: es un campo de dominio cerrado del contrato (RN-01)', () => {
    const errores = validar(RegistrarUsuarioDto, {
      correo: 'a@tecnm.mx',
      contrasena: 'contrasena-larga',
      tipoUsuario: 'administrador',
    });

    expect(errores.join(' ')).toContain('tipoUsuario debe ser uno de');
  });

  it('rechaza correos y contraseñas que no cumplen el mínimo', () => {
    const errores = validar(RegistrarUsuarioDto, {
      correo: 'no-es-un-correo',
      contrasena: 'corta',
      tipoUsuario: 'alumno',
    });

    expect(errores).toHaveLength(2);
  });
});
