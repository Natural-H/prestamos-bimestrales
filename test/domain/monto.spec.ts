import { Monto } from '../../src/domain/value-objects/monto';
import { Porcentaje } from '../../src/domain/value-objects/porcentaje';
import { MontoInvalidoError } from '../../src/domain/errors/monto-invalido.error';
import { PorcentajeInvalidoError } from '../../src/domain/errors/porcentaje-invalido.error';

/** 16 % bimestral del trabajador (RN-08). */
const DIECISEIS_POR_CIENTO = Porcentaje.dePorCiento(16);
/** 32 % del beneficio de diciembre (RN-10). */
const TREINTA_Y_DOS_POR_CIENTO = Porcentaje.dePorCiento(32);

describe('Monto', () => {
  describe('construcción', () => {
    it('acepta una cantidad en pesos con dos decimales, como cadena o como número', () => {
      expect(Monto.desdePesos('3500.00').enCentavos).toBe(350_000);
      expect(Monto.desdePesos(3500).enCentavos).toBe(350_000);
      expect(Monto.desdePesos('0.01').enCentavos).toBe(1);
      expect(Monto.desdePesos(12_345.67).enCentavos).toBe(1_234_567);
    });

    it('rechaza cantidades con más de dos decimales: no existe la fracción de centavo (RN-14)', () => {
      expect(() => Monto.desdePesos(0.001)).toThrow(MontoInvalidoError);
      expect(() => Monto.desdePesos('1.234')).toThrow(MontoInvalidoError);
    });

    it('rechaza cantidades negativas: todos los montos del negocio son no negativos', () => {
      expect(() => Monto.desdePesos(-1)).toThrow(MontoInvalidoError);
      expect(() => Monto.desdeCentavos(-1)).toThrow(MontoInvalidoError);
    });

    it('rechaza entradas que no son cantidades de dinero', () => {
      expect(() => Monto.desdePesos('mil pesos')).toThrow(MontoInvalidoError);
      expect(() => Monto.desdePesos(Number.NaN)).toThrow(MontoInvalidoError);
      expect(() => Monto.desdeCentavos(1.5)).toThrow(MontoInvalidoError);
    });
  });

  describe('porcentaje con redondeo half-up al centavo (RN-19)', () => {
    it('reproduce el ejemplo documentado: $12,345.67 × 16 % = $1,975.31', () => {
      const sueldoBase = Monto.desdePesos('12345.67');

      const prestamo = sueldoBase.porcentaje(DIECISEIS_POR_CIENTO);

      // 1 234 567 × 16 % = 197 530.72 centavos → half-up → 197 531
      expect(prestamo.enCentavos).toBe(197_531);
      expect(prestamo.aCadena()).toBe('1975.31');
    });

    it('redondea hacia arriba el empate exacto de media unidad', () => {
      // 3.13 × 16 % = 0.5008 centavos… buscamos un empate limpio: 50 centavos × 1 % = 0.5
      const medioCentavo = Monto.desdeCentavos(50).porcentaje(Porcentaje.dePorCiento(1));

      expect(medioCentavo.enCentavos).toBe(1);
    });

    it('no pierde el centavo por debajo del empate', () => {
      // 49 centavos × 1 % = 0.49 → 0
      expect(Monto.desdeCentavos(49).porcentaje(Porcentaje.dePorCiento(1)).enCentavos).toBe(0);
    });

    it('calcula el 32 % de diciembre como el doble exacto del 16 % cuando no hay fracción', () => {
      const sueldoBase = Monto.desdePesos('20000.00');

      expect(sueldoBase.porcentaje(DIECISEIS_POR_CIENTO).aCadena()).toBe('3200.00');
      expect(sueldoBase.porcentaje(TREINTA_Y_DOS_POR_CIENTO).aCadena()).toBe('6400.00');
    });

    it('es exacto al acumular varios bimestres, sin arrastre de coma flotante (RN-08)', () => {
      const sueldoBase = Monto.desdePesos('12345.67');
      const porBimestre = sueldoBase.porcentaje(DIECISEIS_POR_CIENTO);

      // Cinco bimestres: 5 × 16 % del sueldo base.
      const total = [1, 2, 3, 4, 5].reduce((acumulado) => acumulado.sumar(porBimestre), Monto.CERO);

      expect(total.enCentavos).toBe(197_531 * 5);
      expect(total.aCadena()).toBe('9876.55');
    });
  });

  describe('comparación y formato', () => {
    it('compara contra el tope de $3,500.00 por bimestre del alumno (RN-09)', () => {
      const tope = Monto.desdePesos('3500.00');

      expect(Monto.desdePesos('3500.01').esMayorQue(tope)).toBe(true);
      expect(Monto.desdePesos('3500.00').esMayorQue(tope)).toBe(false);
      expect(Monto.desdePesos('0.01').esMenorQue(tope)).toBe(true);
    });

    it('expone la cantidad como cadena decimal exacta, lista para el DTO y la columna numeric', () => {
      expect(Monto.desdeCentavos(5).aCadena()).toBe('0.05');
      expect(Monto.desdeCentavos(100).aCadena()).toBe('1.00');
      expect(Monto.CERO.aCadena()).toBe('0.00');
      expect(Monto.desdePesos('1975.31').toString()).toBe('MXN 1975.31');
    });

    it('es inmutable: sumar devuelve un monto nuevo', () => {
      const original = Monto.desdePesos('100.00');

      const resultado = original.sumar(Monto.desdePesos('50.00'));

      expect(original.aCadena()).toBe('100.00');
      expect(resultado.aCadena()).toBe('150.00');
    });
  });
});

describe('Porcentaje', () => {
  it('guarda el valor en puntos base para poder calcular con enteros', () => {
    expect(Porcentaje.dePorCiento(16).puntosBase).toBe(1600);
    expect(Porcentaje.dePorCiento(32).puntosBase).toBe(3200);
    expect(Porcentaje.dePorCiento(16.5).puntosBase).toBe(1650);
  });

  it('rechaza porcentajes imposibles o con demasiada precisión', () => {
    expect(() => Porcentaje.dePorCiento(-1)).toThrow(PorcentajeInvalidoError);
    expect(() => Porcentaje.dePorCiento(16.005)).toThrow(PorcentajeInvalidoError);
    expect(() => Porcentaje.dePorCiento(Number.POSITIVE_INFINITY)).toThrow(PorcentajeInvalidoError);
  });
});
