import { PoliticaPrestamoAlumno } from '../../src/domain/services/politica-prestamo-alumno';
import { Monto } from '../../src/domain/value-objects/monto';
import { TipoUsuario } from '../../src/domain/value-objects/tipo-usuario';
import { DiciembreExclusivoTrabajadoresError } from '../../src/domain/errors/diciembre-exclusivo-trabajadores.error';
import { MontoExcedeLimiteError } from '../../src/domain/errors/monto-excede-limite.error';
import { MontoMenorAlMinimoError } from '../../src/domain/errors/monto-menor-al-minimo.error';
import { MontoRequeridoError } from '../../src/domain/errors/monto-requerido.error';

describe('PoliticaPrestamoAlumno (RN-09: rango con tope)', () => {
  const politica = new PoliticaPrestamoAlumno();

  it('aplica al alumno', () => {
    expect(politica.tipoUsuario).toBe(TipoUsuario.ALUMNO);
  });

  describe('monto elegido por el alumno', () => {
    it('acepta el mínimo de $0.01 y el tope de $3,500.00', () => {
      expect(politica.montoParaBimestre(Monto.desdePesos('0.01')).aCadena()).toBe('0.01');
      expect(politica.montoParaBimestre(Monto.desdePesos('3500.00')).aCadena()).toBe('3500.00');
    });

    it('devuelve exactamente lo que el alumno eligió: el sistema valida, no calcula', () => {
      expect(politica.montoParaBimestre(Monto.desdePesos('1234.56')).aCadena()).toBe('1234.56');
    });

    it('rechaza un centavo por encima del tope', () => {
      expect(() => politica.montoParaBimestre(Monto.desdePesos('3500.01'))).toThrow(
        MontoExcedeLimiteError,
      );
    });

    it('rechaza un préstamo de cero pesos', () => {
      expect(() => politica.montoParaBimestre(Monto.CERO)).toThrow(MontoMenorAlMinimoError);
    });

    it('rechaza la solicitud sin monto: no hay valor por defecto que suponer', () => {
      expect(() => politica.montoParaBimestre(null)).toThrow(MontoRequeridoError);
    });
  });

  describe('el tope es POR BIMESTRE, no acumulado (planteamiento §5)', () => {
    it('admite los cinco bimestres al tope, que suman $17,500.00', () => {
      const alTope = Monto.desdePesos('3500.00');

      const total = [1, 2, 3, 4, 5]
        .map(() => politica.montoParaBimestre(alTope))
        .reduce((acumulado, monto) => acumulado.sumar(monto), Monto.CERO);

      expect(total.aCadena()).toBe('17500.00');
    });
  });

  describe('diciembre (RN-12)', () => {
    it('el alumno no tiene derecho al beneficio', () => {
      expect(politica.tieneDerechoADiciembre()).toBe(false);
    });

    it('pedirlo de todos modos falla, aunque el guard de rol ya lo hubiera filtrado', () => {
      expect(() => politica.montoParaDiciembre()).toThrow(DiciembreExclusivoTrabajadoresError);
    });
  });
});
