import { Bimestre, MesReferencia } from '../../src/domain/value-objects/bimestre';
import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { BimestreInexistenteError } from '../../src/domain/errors/bimestre-inexistente.error';
import { RelojFijo } from '../support/reloj-fijo';

const ANIO = 2026;

/** Atajo: la fecha civil de México que ve el dominio para un reloj dado. */
const hoyEnMexico = (reloj: RelojFijo): FechaCivil => FechaCivil.desdeInstante(reloj.now());

describe('Bimestre', () => {
  describe('calendario (RN-02: el mes de referencia es el mes final del periodo)', () => {
    it.each([
      [MesReferencia.FEBRERO, '2026-01-01', '2026-02-28'],
      [MesReferencia.ABRIL, '2026-03-01', '2026-04-30'],
      [MesReferencia.JUNIO, '2026-05-01', '2026-06-30'],
      [MesReferencia.AGOSTO, '2026-07-01', '2026-08-31'],
      [MesReferencia.OCTUBRE, '2026-09-01', '2026-10-31'],
    ])('el bimestre %i abarca de %s a %s', (mes, inicio, fin) => {
      const periodo = Bimestre.crear(mes, ANIO).periodo;

      expect(periodo.inicio.toString()).toBe(inicio);
      expect(periodo.fin.toString()).toBe(fin);
    });

    it('extiende febrero al 29 en año bisiesto', () => {
      expect(Bimestre.crear(MesReferencia.FEBRERO, 2028).periodo.fin.toString()).toBe('2028-02-29');
    });

    it('son cinco y están en orden cronológico (RN-02)', () => {
      const bimestres = Bimestre.todosDelAnio(ANIO);

      expect(bimestres).toHaveLength(5);
      expect(bimestres.map((b) => b.clave)).toEqual([
        '2026-02',
        '2026-04',
        '2026-06',
        '2026-08',
        '2026-10',
      ]);
    });

    it('rechaza meses que no son bimestres, incluido diciembre (RN-02, RN-11)', () => {
      expect(() => Bimestre.crear(3, ANIO)).toThrow(BimestreInexistenteError);
      expect(() => Bimestre.crear(12, ANIO)).toThrow(BimestreInexistenteError);
      expect(() => Bimestre.crear(0, ANIO)).toThrow(BimestreInexistenteError);
    });
  });

  describe('bloqueo por fecha (RN-04)', () => {
    it('el bimestre de febrero sigue disponible el 28 de febrero', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 2, 28, 23, 59));

      expect(Bimestre.crear(MesReferencia.FEBRERO, ANIO).estaDisponible(hoy)).toBe(true);
    });

    it('el bimestre de febrero se bloquea el 1 de marzo, como dice el planteamiento', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 3, 1));

      expect(Bimestre.crear(MesReferencia.FEBRERO, ANIO).estaBloqueado(hoy)).toBe(true);
    });

    it('todos los bimestres están disponibles al iniciar el año (RN-03)', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 1, 1));

      expect(Bimestre.todosDelAnio(ANIO).every((b) => b.estaDisponible(hoy))).toBe(true);
    });

    it('estando en febrero se pueden seleccionar los bimestres posteriores (RN-03)', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 2, 10));
      const disponibles = Bimestre.todosDelAnio(ANIO).filter((b) => b.estaDisponible(hoy));

      expect(disponibles.map((b) => b.clave)).toEqual([
        '2026-02',
        '2026-04',
        '2026-06',
        '2026-08',
        '2026-10',
      ]);
    });

    it('los bimestres vencidos se van retirando de la oferta conforme avanza el año', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 7, 1));
      const disponibles = Bimestre.todosDelAnio(ANIO).filter((b) => b.estaDisponible(hoy));

      // El 1 de julio ya transcurrieron febrero (1 mar), abril (1 may) y junio (1 jul).
      expect(disponibles.map((b) => b.clave)).toEqual(['2026-08', '2026-10']);
    });
  });

  describe('cierre de temporada (RN-05)', () => {
    it('octubre es el último bimestre del año', () => {
      expect(Bimestre.crear(MesReferencia.OCTUBRE, ANIO).esUltimoDelAnio).toBe(true);
      expect(Bimestre.crear(MesReferencia.AGOSTO, ANIO).esUltimoDelAnio).toBe(false);
    });

    it('la temporada sigue abierta el 31 de octubre', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 10, 31));

      expect(Bimestre.temporadaCerrada(ANIO, hoy)).toBe(false);
      expect(Bimestre.todosDelAnio(ANIO).filter((b) => b.estaDisponible(hoy))).toHaveLength(1);
    });

    it('el 1 de noviembre no queda ningún bimestre disponible', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 11, 1));

      expect(Bimestre.temporadaCerrada(ANIO, hoy)).toBe(true);
      expect(Bimestre.todosDelAnio(ANIO).filter((b) => b.estaDisponible(hoy))).toHaveLength(0);
    });

    it('en diciembre la temporada de bimestres sigue cerrada, aunque el beneficio de diciembre no lo esté (RN-11)', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2026, 12, 15));

      expect(Bimestre.temporadaCerrada(ANIO, hoy)).toBe(true);
    });

    it('los bimestres del año siguiente vuelven a estar disponibles (RN-06: registro por usuario y año)', () => {
      const hoy = hoyEnMexico(RelojFijo.enMexico(2027, 1, 1));

      expect(Bimestre.temporadaCerrada(2027, hoy)).toBe(false);
      expect(Bimestre.todosDelAnio(2027).every((b) => b.estaDisponible(hoy))).toBe(true);
    });
  });

  describe('identidad', () => {
    it('dos bimestres del mismo mes y año son el mismo', () => {
      expect(Bimestre.crear(MesReferencia.JUNIO, ANIO).equals(Bimestre.crear(6, ANIO))).toBe(true);
      expect(Bimestre.crear(MesReferencia.JUNIO, ANIO).equals(Bimestre.crear(6, 2027))).toBe(false);
    });

    it('expone una clave estable para la unicidad del registro (RN-06, RN-15)', () => {
      expect(Bimestre.crear(MesReferencia.FEBRERO, ANIO).clave).toBe('2026-02');
      expect(Bimestre.crear(MesReferencia.OCTUBRE, ANIO).clave).toBe('2026-10');
    });
  });
});
