import { PoliticaPrestamoTrabajador } from '../../src/domain/services/politica-prestamo-trabajador';
import { Monto } from '../../src/domain/value-objects/monto';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { MontoNoCapturableError } from '../../src/domain/errors/monto-no-capturable.error';

describe('PoliticaPrestamoTrabajador (RN-08, RN-10: préstamo fijo calculado)', () => {
  const sueldoBase = SueldoBase.desdePesos('12345.67');
  const politica = new PoliticaPrestamoTrabajador(sueldoBase);

  it('aplica al trabajador', () => {
    expect(politica.tipoUsuario).toBe(TipoUsuario.TRABAJADOR);
  });

  describe('bimestre: 16 % del sueldo base (RN-08)', () => {
    it('calcula el monto con redondeo half-up al centavo', () => {
      expect(politica.montoParaBimestre(null).aCadena()).toBe('1975.31');
    });

    it('rechaza que el trabajador capture el monto, aunque coincida con el calculado', () => {
      expect(() => politica.montoParaBimestre(Monto.desdePesos('1975.31'))).toThrow(
        MontoNoCapturableError,
      );
      expect(() => politica.montoParaBimestre(Monto.desdePesos('9999.99'))).toThrow(
        MontoNoCapturableError,
      );
    });

    it('N bimestres equivalen a N × 16 % del sueldo base (planteamiento §5)', () => {
      const total = [1, 2, 3]
        .map(() => politica.montoParaBimestre(null))
        .reduce((acumulado, monto) => acumulado.sumar(monto), Monto.CERO);

      expect(total.aCadena()).toBe('5925.93');
    });
  });

  describe('diciembre: 32 % del sueldo base (RN-10)', () => {
    it('el trabajador sí tiene derecho al beneficio', () => {
      expect(politica.tieneDerechoADiciembre()).toBe(true);
    });

    it('calcula el 32 % sobre el sueldo base', () => {
      expect(politica.montoParaDiciembre().aCadena()).toBe('3950.61');
    });

    it('lo calcula sobre el sueldo, no duplicando el 16 % ya redondeado', () => {
      // 12 345.67 × 32 % = 3 950.6144 → 3 950.61
      // 2 × (12 345.67 × 16 % → 1 975.31) = 3 950.62
      // Manda el planteamiento: "32 % del sueldo base". La diferencia de un
      // centavo es real y está aquí para que nadie la "corrija" por intuición.
      const dobleDelBimestre = politica
        .montoParaBimestre(null)
        .sumar(politica.montoParaBimestre(null));

      expect(politica.montoParaDiciembre().aCadena()).toBe('3950.61');
      expect(dobleDelBimestre.aCadena()).toBe('3950.62');
    });

    it('es el único monto del año al 32 %: el bimestre sigue al 16 %', () => {
      const sueldoRedondo = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('20000.00'));

      expect(sueldoRedondo.montoParaBimestre(null).aCadena()).toBe('3200.00');
      expect(sueldoRedondo.montoParaDiciembre().aCadena()).toBe('6400.00');
    });
  });

  describe('el monto flota con el sueldo vigente (RN-13, RN-20)', () => {
    it('subir el sueldo sube los montos, sin tocar nada persistido', () => {
      const conAumento = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('20000.00'));

      expect(politica.montoParaBimestre(null).aCadena()).toBe('1975.31');
      expect(conAumento.montoParaBimestre(null).aCadena()).toBe('3200.00');
    });

    it('bajar el sueldo también recalcula: la actualización acepta cualquier valor válido (RN-13)', () => {
      const conBaja = new PoliticaPrestamoTrabajador(SueldoBase.desdePesos('10000.00'));

      expect(conBaja.montoParaBimestre(null).aCadena()).toBe('1600.00');
      expect(conBaja.montoParaDiciembre().aCadena()).toBe('3200.00');
    });
  });
});
