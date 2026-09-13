import { FechaCivil } from '../../src/domain/value-objects/fecha-civil';
import { Periodo } from '../../src/domain/value-objects/periodo';
import { PeriodoInvalidoError } from '../../src/domain/errors/periodo-invalido.error';

describe('Periodo', () => {
  /** El bimestre de febrero de 2026: 1 de enero – 28 de febrero (RN-02). */
  const bimestreDeFebrero = Periodo.entre(FechaCivil.de(2026, 1, 1), FechaCivil.de(2026, 2, 28));

  it('exige que el fin no preceda al inicio', () => {
    expect(() => Periodo.entre(FechaCivil.de(2026, 3, 1), FechaCivil.de(2026, 1, 1))).toThrow(
      PeriodoInvalidoError,
    );
  });

  it('admite un periodo de un solo día', () => {
    const unDia = FechaCivil.de(2026, 12, 31);

    expect(Periodo.entre(unDia, unDia).contiene(unDia)).toBe(true);
  });

  it('incluye ambos extremos', () => {
    expect(bimestreDeFebrero.contiene(FechaCivil.de(2026, 1, 1))).toBe(true);
    expect(bimestreDeFebrero.contiene(FechaCivil.de(2026, 2, 28))).toBe(true);
    expect(bimestreDeFebrero.contiene(FechaCivil.de(2026, 2, 15))).toBe(true);
  });

  it('sólo se considera transcurrido cuando la fecha SUPERA el fin (RN-04)', () => {
    expect(bimestreDeFebrero.haTranscurrido(FechaCivil.de(2026, 2, 28))).toBe(false);
    expect(bimestreDeFebrero.haTranscurrido(FechaCivil.de(2026, 3, 1))).toBe(true);
  });

  it('distingue el periodo futuro, que aún no inicia (RN-03, RN-07)', () => {
    const bimestreDeOctubre = Periodo.entre(FechaCivil.de(2026, 9, 1), FechaCivil.de(2026, 10, 31));

    expect(bimestreDeOctubre.aunNoInicia(FechaCivil.de(2026, 2, 1))).toBe(true);
    expect(bimestreDeOctubre.contiene(FechaCivil.de(2026, 2, 1))).toBe(false);
    expect(bimestreDeOctubre.haTranscurrido(FechaCivil.de(2026, 2, 1))).toBe(false);
  });
});
