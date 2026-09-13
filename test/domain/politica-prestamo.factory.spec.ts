import { PoliticaPrestamoFactory } from '../../src/domain/services/politica-prestamo.factory';
import { PoliticaPrestamoAlumno } from '../../src/domain/services/politica-prestamo-alumno';
import { PoliticaPrestamoTrabajador } from '../../src/domain/services/politica-prestamo-trabajador';
import { SueldoBase } from '../../src/domain/value-objects/sueldo-base';
import { TipoUsuario, tipoUsuarioDesde } from '../../src/domain/value-objects/tipo-usuario';
import { SueldoBaseNoRegistradoError } from '../../src/domain/errors/sueldo-base-no-registrado.error';
import { SueldoBaseInvalidoError } from '../../src/domain/errors/sueldo-base-invalido.error';
import { TipoUsuarioInvalidoError } from '../../src/domain/errors/tipo-usuario-invalido.error';
import { MontoInvalidoError } from '../../src/domain/errors/monto-invalido.error';

describe('PoliticaPrestamoFactory', () => {
  it('da al alumno su política de rango con tope', () => {
    const politica = PoliticaPrestamoFactory.crear(TipoUsuario.ALUMNO, null);

    expect(politica).toBeInstanceOf(PoliticaPrestamoAlumno);
    expect(politica.tieneDerechoADiciembre()).toBe(false);
  });

  it('ignora el sueldo base si lo recibe para un alumno: no existe en su modelo', () => {
    const politica = PoliticaPrestamoFactory.crear(
      TipoUsuario.ALUMNO,
      SueldoBase.desdePesos('100'),
    );

    expect(politica).toBeInstanceOf(PoliticaPrestamoAlumno);
  });

  it('da al trabajador su política de préstamo fijo, atada al sueldo vigente', () => {
    const politica = PoliticaPrestamoFactory.crear(
      TipoUsuario.TRABAJADOR,
      SueldoBase.desdePesos('20000.00'),
    );

    expect(politica).toBeInstanceOf(PoliticaPrestamoTrabajador);
    expect(politica.montoParaBimestre(null).aCadena()).toBe('3200.00');
  });

  it('impide calcular nada para un trabajador sin sueldo base capturado (RN-08, EC-06)', () => {
    expect(() => PoliticaPrestamoFactory.crear(TipoUsuario.TRABAJADOR, null)).toThrow(
      SueldoBaseNoRegistradoError,
    );
  });
});

describe('SueldoBase (RN-13)', () => {
  it('acepta cualquier cantidad positiva', () => {
    expect(SueldoBase.desdePesos('0.01').monto.aCadena()).toBe('0.01');
    expect(SueldoBase.desdePesos('12345.67').monto.aCadena()).toBe('12345.67');
  });

  it('rechaza un sueldo de cero: sin él no hay préstamo que calcular', () => {
    expect(() => SueldoBase.desdePesos('0.00')).toThrow(SueldoBaseInvalidoError);
  });

  it('rechaza valores que ni siquiera son dinero válido', () => {
    expect(() => SueldoBase.desdePesos(-100)).toThrow(MontoInvalidoError);
    expect(() => SueldoBase.desdePesos('1.234')).toThrow(MontoInvalidoError);
  });

  it('es inmutable y se compara por valor: actualizar el sueldo es sustituirlo', () => {
    expect(SueldoBase.desdePesos('100.00').equals(SueldoBase.desdePesos('100.00'))).toBe(true);
    expect(SueldoBase.desdePesos('100.00').equals(SueldoBase.desdePesos('100.01'))).toBe(false);
  });
});

describe('TipoUsuario (RN-01)', () => {
  it('traduce los valores que llegan de la base de datos o del rol del JWT', () => {
    expect(tipoUsuarioDesde('alumno')).toBe(TipoUsuario.ALUMNO);
    expect(tipoUsuarioDesde('trabajador')).toBe(TipoUsuario.TRABAJADOR);
  });

  it('rechaza cualquier otro valor antes de que llegue al cálculo del préstamo', () => {
    expect(() => tipoUsuarioDesde('administrador')).toThrow(TipoUsuarioInvalidoError);
    expect(() => tipoUsuarioDesde('ALUMNO')).toThrow(TipoUsuarioInvalidoError);
    expect(() => tipoUsuarioDesde('')).toThrow(TipoUsuarioInvalidoError);
  });
});
