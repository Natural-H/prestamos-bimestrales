import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { FechaInvalidaError } from '../../src/domain/errors/fecha-invalida.error';
import { RelojFijo } from '../support/reloj-fijo';

describe('FechaCivil', () => {
  describe('conversión desde un instante', () => {
    it('traduce el instante a la fecha que se vive en México, no a la de UTC', () => {
      // 1 de marzo 05:30 UTC = 28 de febrero 23:30 en México (UTC-6).
      // Si el dominio comparara instantes UTC, el bimestre de febrero quedaría
      // bloqueado medio día antes de tiempo (RN-04).
      const reloj = RelojFijo.enUtc('2026-03-01T05:30:00Z');

      expect(FechaCivil.desdeInstante(reloj.now()).toString()).toBe('2026-02-28');
    });

    it('cambia de día exactamente a la medianoche de México', () => {
      expect(
        FechaCivil.desdeInstante(RelojFijo.enUtc('2026-03-01T06:00:00Z').now()).toString(),
      ).toBe('2026-03-01');
    });

    it('toma el instante del reloj inyectado, nunca el del sistema (CLAUDE.md §7.5)', () => {
      const reloj = RelojFijo.enMexico(2026, 7, 15, 9, 30);

      expect(FechaCivil.desdeInstante(reloj.now()).toString()).toBe('2026-07-15');
    });
  });

  describe('validación del calendario', () => {
    it('rechaza días que no existen', () => {
      expect(() => FechaCivil.de(2026, 2, 29)).toThrow(FechaInvalidaError);
      expect(() => FechaCivil.de(2026, 4, 31)).toThrow(FechaInvalidaError);
      expect(() => FechaCivil.de(2026, 13, 1)).toThrow(FechaInvalidaError);
    });

    it('acepta el 29 de febrero en año bisiesto', () => {
      expect(FechaCivil.de(2028, 2, 29).toString()).toBe('2028-02-29');
      expect(FechaCivil.ultimoDiaDelMes(2028, 2)).toBe(29);
      expect(FechaCivil.ultimoDiaDelMes(2026, 2)).toBe(28);
    });
  });

  describe('comparación', () => {
    it('ordena por año, mes y día', () => {
      const finDeFebrero = FechaCivil.de(2026, 2, 28);
      const inicioDeMarzo = FechaCivil.de(2026, 3, 1);

      expect(inicioDeMarzo.esPosteriorA(finDeFebrero)).toBe(true);
      expect(finDeFebrero.esAnteriorA(inicioDeMarzo)).toBe(true);
      expect(finDeFebrero.equals(FechaCivil.de(2026, 2, 28))).toBe(true);
      expect(FechaCivil.de(2027, 1, 1).esPosteriorA(inicioDeMarzo)).toBe(true);
    });
  });
});
