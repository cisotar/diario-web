// AULAS.JS — Exportado em 05/03/2026, 04:45:29

const BIMESTRES = [
  {
    "bimestre": 1,
    "label": "1º Bimestre",
    "inicio": "2026-02-02",
    "fim": "2026-04-22"
  },
  {
    "bimestre": 2,
    "label": "2º Bimestre",
    "inicio": "2026-04-23",
    "fim": "2026-07-06"
  },
  {
    "bimestre": 3,
    "label": "3º Bimestre",
    "inicio": "2026-07-24",
    "fim": "2026-10-02"
  },
  {
    "bimestre": 4,
    "label": "4º Bimestre",
    "inicio": "2026-10-05",
    "fim": "2026-12-18"
  }
];

const TURMAS    = [
  {
    "id": "1A_GEO",
    "serie": "1",
    "turma": "A",
    "subtitulo": "",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 1,
        "aula": "a6"
      },
      {
        "diaSemana": 1,
        "aula": "a7"
      }
    ]
  },
  {
    "id": "1B_GEO",
    "serie": "1",
    "turma": "B",
    "subtitulo": "",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 1,
        "aula": "a5"
      },
      {
        "diaSemana": 3,
        "aula": "a6"
      }
    ]
  },
  {
    "id": "1C_GEO",
    "serie": "1",
    "turma": "C",
    "subtitulo": "",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 3,
        "aula": "a1"
      },
      {
        "diaSemana": 2,
        "aula": "a7"
      }
    ]
  },
  {
    "id": "1D_GEO",
    "serie": "1",
    "turma": "D",
    "subtitulo": "",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 3,
        "aula": "a5"
      },
      {
        "diaSemana": 3,
        "aula": "a7"
      }
    ]
  },
  {
    "id": "1E_GEO",
    "serie": "1",
    "turma": "E",
    "subtitulo": "",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 3,
        "aula": "a2"
      },
      {
        "diaSemana": 4,
        "aula": "a3"
      }
    ]
  },
  {
    "id": "2A_GEO",
    "serie": "2",
    "turma": "A",
    "subtitulo": "ADM",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 3,
        "aula": "a3"
      },
      {
        "diaSemana": 4,
        "aula": "a6"
      }
    ]
  },
  {
    "id": "2B_GEO",
    "serie": "2",
    "turma": "B",
    "subtitulo": "SIST",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 2,
        "aula": "a4"
      },
      {
        "diaSemana": 4,
        "aula": "a5"
      }
    ]
  },
  {
    "id": "2C_GEO",
    "serie": "2",
    "turma": "C",
    "subtitulo": "HUM",
    "disciplina": "Geografia",
    "sigla": "GEO",
    "horarios": [
      {
        "diaSemana": 2,
        "aula": "a5"
      },
      {
        "diaSemana": 4,
        "aula": "a2"
      }
    ]
  },
  {
    "id": "2A_SOC",
    "serie": "2",
    "turma": "A",
    "subtitulo": "ADM",
    "disciplina": "Sociologia",
    "sigla": "SOC",
    "horarios": [
      {
        "diaSemana": 5,
        "aula": "a6"
      },
      {
        "diaSemana": 5,
        "aula": "a7"
      }
    ]
  },
  {
    "id": "2B_SOC",
    "serie": "2",
    "turma": "B",
    "subtitulo": "SIST",
    "disciplina": "Sociologia",
    "sigla": "SOC",
    "horarios": [
      {
        "diaSemana": 3,
        "aula": "a4"
      },
      {
        "diaSemana": 4,
        "aula": "a1"
      }
    ]
  },
  {
    "id": "2C_SOC",
    "serie": "2",
    "turma": "C",
    "subtitulo": "HUM",
    "disciplina": "Sociologia",
    "sigla": "SOC",
    "horarios": [
      {
        "diaSemana": 2,
        "aula": "a3"
      },
      {
        "diaSemana": 4,
        "aula": "a7"
      }
    ]
  },
  {
    "id": "3B_ATUAL",
    "serie": "3",
    "turma": "B",
    "subtitulo": "HUM",
    "disciplina": "Atualidades",
    "sigla": "ATUAL",
    "horarios": [
      {
        "diaSemana": 2,
        "aula": "a6"
      },
      {
        "diaSemana": 4,
        "aula": "a4"
      }
    ]
  }
];

const CONTEUDOS = {
  "1_Geografia": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "Contrato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Aula 1 - Climatologia e meteorologia",
    "Aula 2 - Atmosfera",
    "Aula 3 - Elementos e controles climáticos",
    "Aula 4 - Climograma",
    "Aula 5 - Elaboração de climogramas",
    "Aula 6 - Recursos hídricos",
    "Aula 7 - Gestão sustentável dos recursos hídricos",
    "Aula 8 - Relevo",
    "Aula 9 - Relevo e ocupação humana",
    "Aula 10 - Riscos geológicos",
    "Aula 11 - Prevenção e mitigação de impactos",
    "Aula 12 - Principais biomas do planeta Terra",
    "Aula 13 - Biomas do estado de São Paulo",
    "Aula 14 - Sistema Nacional de Unidades de Conservação da natureza (SNUC)"
  ],
  "2_Geografia": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "Contrato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Aula 01 - Demografia",
    "Aula 02 - Demografia brasileira",
    "Aula 03 - Pesquisas demográficas",
    "Aula 04 - Demografia da comunidade escolar",
    "Aula 05 - Economia do Brasil",
    "Aula 06 - O Brasil na economia mundial",
    "Aula 07 - Brasil - indicadores socioeconômicos",
    "Aula 08 - Desigualdade socioeconômica",
    "Aula 09 - O trabalho no Brasil",
    "Aula 10 - Estado, nação e território",
    "Aula 11 - Formação dos Estados e das nações no mundo",
    "Aula 12 - Povos sem Estado",
    "Aula 13 - Conflitos territoriais e geopolítica contemporânea",
    "Aula 14 - Identidade, pertencimento e território"
  ],
  "2_Sociologia": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "Contrato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Aula 01 - A Sociologia no Ensino Médio",
    "Aula 02 - O surgimento da Sociologia",
    "Aula 03 - A sociedade em Émile Durkheim",
    "Aula 04 - Indivíduo e sociedade",
    "Aula 05 - A sociedade em Max Weber",
    "Aula 06 - Indivíduo e sociedade - a perspectiva de Max Weber",
    "Aula 07 - A sociedade em Karl Marx",
    "Aula 08 - Indivíduo e sociedade - a perspectiva de Karl Marx",
    "Aula 09 - Cultura e sociedade",
    "Aula 10 - Aprendendo a viver em sociedade",
    "Aula 11 - Eu, nós, eles - a construção social das identidades",
    "Aula 12 - Identidade cultural e as relações entre culturas",
    "Aula 13 - O fazer sociológico",
    "Aula 14 - Praticando o olhar sociológico",
    "Aula 15 - Trilha de Exercícios"
  ],
  "3_Atualidades": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "Contrato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Aula 1 - Repertório: a imagem que mente — verdade e simulação na cultura digital",
    "Aula 2 - Repertório: verdade, prova e confiança na era das imagens manipuladas",
    "Aula 3 - Estudo de caso: quando a imagem mente – deepfakes e responsabilidade pública",
    "Aula 4 - Estudo de caso e discussão: algoritmos, crenças e fabricação da verdade digital",
    "Aula 5 - Oficina de escrita: o editorial analítico e a autenticidade em tempos de IA",
    "Aula 6 - Oficina de escrita: autoria, argumento e responsabilidade no editorial crítico",
    "Aula 7 - Síntese: curadoria e publicação — autoria e verdade na era da simulação",
    "Aula 8 - Repertório: criação, arte, técnica e autoria ao longo do tempo",
    "Aula 9 - Repertório: inteligência artificial e criação artística",
    "Aula 10 - Estudo de caso e discussão: arte, autoria e criação algorítmica (Parte 1)",
    "Aula 11 - Estudo de caso e discussão: arte, autoria e criação algorítmica (Parte 2)",
    "Aula 12 - Oficina de escrita: o dossiê como forma de pensamento",
    "Aula 13 - Oficina de escrita: o dossiê reflexivo-analítico",
    "Aula 14 - Síntese: curadoria analítica — a criação humana diante da máquina"
  ]
};

// Restore: localStorage.setItem("aulaOrdem", JSON.stringify(ORDEM));

//          localStorage.setItem("aulaEstado", JSON.stringify(ESTADO));

const ORDEM  = {
  "2A_GEO_b1": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    12,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22
  ],
  "1A_GEO_b1": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23
  ]
};

const ESTADO = {
  "1A_GEO_b1_a0": {
    "feita": false,
    "dataFeita": null
  },
  "1B_GEO_b1_a0": {
    "feita": false,
    "dataFeita": null
  },
  "1A_GEO_b1_a15": {
    "conteudoEditado": "— sem conteúdo —"
  },
  "1A_GEO_b1_sr0": {
    "feita": true,
    "dataFeita": "2026-03-05",
    "chamada": false,
    "conteudoEntregue": false
  },
  "1A_GEO_b1_sr3": {
    "feita": true,
    "dataFeita": "2026-03-05"
  },
  "1A_GEO_b1_sr1": {
    "feita": true,
    "dataFeita": "2026-03-05"
  },
  "1A_GEO_b1_sr2": {
    "feita": true,
    "dataFeita": "2026-03-05"
  },
  "1A_GEO_b1_sr4": {
    "feita": true,
    "dataFeita": "2026-03-05"
  }
};