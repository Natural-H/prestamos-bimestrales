import { PoliticaPrestamoAlumno } from '../../src/domain/services/politica-prestamo-alumno';
import { PoliticaPrestamoTrabajador } from '../../src/domain/services/politica-prestamo-trabajador';
import { Bimestre } from '../../src/domain/value-objects/bimestre';
import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { PeriodoDiciembre } from '../../src/domain/value-objects/periodo-diciembre';
import { SolicitanteId } from '../../src/domain/value-objects/solicitante-id';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { DiciembreExclusivoTrabajadoresError } from '../../src/domain/errors/diciembre-exclusivo-trabajadores.error';
import { FechaInvalidaError } from '../../src/domain/errors/fecha-invalida.error';
import { PeriodoDiciembreCerradoError } from '../../src/domain/errors/periodo-diciembre-cerrado.error';
import { SolicitanteIdInvalidoError } from '../../src/domain/errors/solicitante-id-invalido.error';
import { RelojFijo } from '../support/reloj-fijo';

const ANIO = 2026;
const diciembre = PeriodoDiciembre.delAnio(ANIO);

const hoyEnMexico = (anio: number, mes: number, dia: number): FechaCivil =>
  FechaCivil.desdeInstante(RelojFijo.enMexico(anio, mes, dia).now());

describe('PeriodoDiciembre (RN-10, RN-11)', () => {
  it('abarca del 1 al 31 de diciembre', () => {
    expect(diciembre.periodo.inicio.toString()).toBe('2026-12-01');
    expect(diciembre.periodo.fin.toString()).toBe('2026-12-31');
  });

  it('usa una clave homogénea con la de los bimestres', () => {
    expect(diciembre.clave).toBe('2026-12');
    expect(diciembre.toString()).toBe('2026-12');
    expect(diciembre.anio).toBe(ANIO);
  });

  it('rechaza un año que no es entero', () => {
    expect(() => PeriodoDiciembre.delAnio(2026.5)).toThrow(FechaInvalidaError);
  });

  describe('plazo propio, independiente del cierre de octubre (RN-11)', () => {
    it('sigue disponible el 1 de noviembre, cuando ya no queda ningún bimestre', () => {
      const hoy = hoyEnMexico(ANIO, 11, 1);

      expect(Bimestre.temporadaCerrada(ANIO, hoy)).toBe(true);
      expect(diciembre.estaDisponible(hoy)).toBe(true);
    });

    it('sigue disponible el 31 de diciembre', () => {
      expect(diciembre.estaDisponible(hoyEnMexico(ANIO, 12, 31))).toBe(true);
      expect(() => diciembre.validarQuePuedeSolicitarse(hoyEnMexico(ANIO, 12, 31))).not.toThrow();
    });

    it('se bloquea el 1 de enero siguiente', () => {
      const hoy = hoyEnMexico(2027, 1, 1);

      expect(diciembre.estaBloqueado(hoy)).toBe(true);
      expect(() => diciembre.validarQuePuedeSolicitarse(hoy)).toThrow(PeriodoDiciembreCerradoError);
    });

    it('también está disponible antes de diciembre: se puede solicitar por adelantado (RN-03)', () => {
      expect(diciembre.estaDisponible(hoyEnMexico(ANIO, 2, 1))).toBe(true);
    });
  });

  describe('monto', () => {
    it('delega en la política del trabajador: 32 % del sueldo vigente', () => {
      const politica = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('20000.00'));

      expect(diciembre.montoSegun(politica).aCadena()).toBe('6400.00');
    });

    it('para el alumno no hay monto que calcular (RN-12)', () => {
      expect(() => diciembre.montoSegun(new PoliticaPrestamoAlumno())).toThrow(
        DiciembreExclusivoTrabajadoresError,
      );
    });
  });

  it('se compara por valor', () => {
    expect(diciembre.equals(PeriodoDiciembre.delAnio(ANIO))).toBe(true);
    expect(diciembre.equals(PeriodoDiciembre.delAnio(2027))).toBe(false);
  });
});

describe('SolicitanteId', () => {
  it('normaliza los espacios sobrantes', () => {
    expect(SolicitanteId.de('  usuario-1  ').valor).toBe('usuario-1');
    expect(SolicitanteId.de('usuario-1').toString()).toBe('usuario-1');
  });

  it('rechaza identificadores vacíos o en blanco', () => {
    expect(() => SolicitanteId.de('')).toThrow(SolicitanteIdInvalidoError);
    expect(() => SolicitanteId.de('   ')).toThrow(SolicitanteIdInvalidoError);
  });

  it('se compara por valor', () => {
    expect(SolicitanteId.de('a').equals(SolicitanteId.de('a'))).toBe(true);
    expect(SolicitanteId.de('a').equals(SolicitanteId.de('b'))).toBe(false);
  });
});
