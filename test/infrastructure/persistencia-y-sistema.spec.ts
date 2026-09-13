import { PeriodoSolicitado } from '../../src/domain/entities/periodo-solicitado.entity';
import { Bimestre, MesReferencia } from '../../src/domain/value-objects/bimestre';
import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { Monto } from '../../src/domain/value-objects/monto';
import { PeriodoDiciembre } from '../../src/domain/value-objects/periodo-diciembre';
import { SystemClock } from '../../src/infrastructure/clock/system-clock';
import { UuidGeneratorAdapter } from '../../src/infrastructure/id/uuid-generator.adapter';
import { PeriodoSolicitadoOrmEntity } from '../../src/infrastructure/persistence/typeorm/entities/solicitud-prestamo.orm-entity';
import { SolicitudPrestamoOrmMapper } from '../../src/infrastructure/persistence/typeorm/mappers/solicitud-prestamo.orm-mapper';

/** Fila como la que devuelve el driver, con los valores por defecto rellenos. */
const fila = (datos: Partial<PeriodoSolicitadoOrmEntity>): PeriodoSolicitadoOrmEntity =>
  ({
    id: 'fila-1',
    solicitudId: 'solicitud-1',
    anio: 2026,
    montoCapturado: null,
    fechaSolicitud: '2026-01-15',
    createdAt: new Date(),
    ...datos,
  }) as PeriodoSolicitadoOrmEntity;

describe('SolicitudPrestamoOrmMapper', () => {
  describe('de fila a value object del periodo', () => {
    it('reconstruye un bimestre', () => {
      const periodo = SolicitudPrestamoOrmMapper.aPeriodoSolicitable(
        fila({ tipo: 'bimestre', mesReferencia: 10 }),
      );

      expect(periodo).toBeInstanceOf(Bimestre);
      expect(periodo.clave).toBe('2026-10');
      expect(periodo.periodo.inicio.toString()).toBe('2026-09-01');
    });

    it('reconstruye diciembre como su propio concepto, no como un bimestre (RN-11)', () => {
      const periodo = SolicitudPrestamoOrmMapper.aPeriodoSolicitable(
        fila({ tipo: 'diciembre', mesReferencia: 12 }),
      );

      expect(periodo).toBeInstanceOf(PeriodoDiciembre);
      expect(periodo.periodo.inicio.toString()).toBe('2026-12-01');
    });
  });

  describe('la fecha de solicitud vuelve como día civil', () => {
    it('acepta la cadena YYYY-MM-DD del driver', () => {
      const solicitud = SolicitudPrestamoOrmMapper.aDominio(
        'usuario-1',
        2026,
        [fila({ tipo: 'bimestre', mesReferencia: 2, fechaSolicitud: '2026-01-15' })],
        1,
      );

      expect(solicitud.periodosSolicitados[0]?.fechaSolicitud.toString()).toBe('2026-01-15');
    });

    it('acepta también un Date, según cómo esté configurado el driver', () => {
      // La columna es `date`; algunos drivers la entregan como Date. Que el
      // dominio reciba siempre un día civil —y no un instante con zona— es lo
      // que evita los errores de un día (RN-04).
      const solicitud = SolicitudPrestamoOrmMapper.aDominio(
        'usuario-1',
        2026,
        [
          fila({
            tipo: 'bimestre',
            mesReferencia: 2,
            fechaSolicitud: new Date('2026-01-15T00:00:00Z') as unknown as string,
          }),
        ],
        1,
      );

      expect(solicitud.periodosSolicitados[0]?.fechaSolicitud.toString()).toBe('2026-01-15');
    });
  });

  describe('el dinero viaja como cadena en los dos sentidos (RN-14)', () => {
    it('convierte el numeric del driver sin pasar por coma flotante', () => {
      const solicitud = SolicitudPrestamoOrmMapper.aDominio(
        'usuario-1',
        2026,
        [fila({ tipo: 'bimestre', mesReferencia: 2, montoCapturado: '1234.56' })],
        1,
      );

      expect(solicitud.periodosSolicitados[0]?.montoCapturado?.enCentavos).toBe(123456);
    });

    it('escribe el monto capturado como cadena decimal exacta', () => {
      const escrita = SolicitudPrestamoOrmMapper.aFila(
        'solicitud-1',
        new PeriodoSolicitado(
          Bimestre.crear(MesReferencia.FEBRERO, 2026),
          Monto.desdePesos('1234.5'),
          FechaCivil.de(2026, 1, 15),
        ),
      );

      expect(escrita).toMatchObject({
        tipo: 'bimestre',
        mesReferencia: 2,
        anio: 2026,
        montoCapturado: '1234.50',
        fechaSolicitud: '2026-01-15',
      });
    });

    it('deja el monto del trabajador en nulo: no se persiste, se deriva (RN-20)', () => {
      const escrita = SolicitudPrestamoOrmMapper.aFila(
        'solicitud-1',
        new PeriodoSolicitado(PeriodoDiciembre.delAnio(2026), null, FechaCivil.de(2026, 9, 12)),
      );

      expect(escrita.montoCapturado).toBeNull();
      expect(escrita.tipo).toBe('diciembre');
      expect(escrita.mesReferencia).toBe(12);
    });
  });
});

describe('SystemClock', () => {
  it('devuelve el instante actual', () => {
    const antes = Date.now();

    const ahora = new SystemClock().now().getTime();

    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });

  it('es la única pieza que lee el reloj: el dominio lo recibe por el puerto', () => {
    // Comprobación de contrato: cumple ClockPort y por tanto es sustituible por
    // el RelojFijo de las pruebas sin que nadie más se entere (§5-L).
    const reloj = new SystemClock();

    expect(typeof reloj.now).toBe('function');
    expect(reloj.now()).toBeInstanceOf(Date);
  });
});

describe('UuidGeneratorAdapter', () => {
  it('genera identificadores con formato UUID', () => {
    expect(new UuidGeneratorAdapter().generar()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('no repite: es la aplicación quien asigna el id, no la base de datos', () => {
    const generador = new UuidGeneratorAdapter();

    const identificadores = new Set(Array.from({ length: 500 }, () => generador.generar()));

    expect(identificadores.size).toBe(500);
  });
});
