// AULAS.JS — Exportado em 11/03/2026, 20:10:44

const BIMESTRES = [
  {
    "bimesTRe": 1,
    "label": "1º BimesTRe",
    "inicio": "2026-02-02",
    "fim": "2026-04-22"
  },
  {
    "bimesTRe": 2,
    "label": "2º BimesTRe",
    "inicio": "2026-04-23",
    "fim": "2026-07-06"
  },
  {
    "bimesTRe": 3,
    "label": "3º BimesTRe",
    "inicio": "2026-07-24",
    "fim": "2026-10-02"
  },
  {
    "bimesTRe": 4,
    "label": "4º BimesTRe",
    "inicio": "2026-10-05",
    "fim": "2026-12-18"
  }
];

const TURMAS    = [
  {
    "id": "1A_GEO",
    "serie": "1",
    "tuRMa": "A",
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
    "tuRMa": "B",
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
    "tuRMa": "C",
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
    "tuRMa": "D",
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
    "tuRMa": "E",
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
    "tuRMa": "A",
    "subtitulo": "(ADM)",
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
    "tuRMa": "B",
    "subtitulo": "(ADS)",
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
    "tuRMa": "C",
    "subtitulo": "(HUM)",
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
    "tuRMa": "A",
    "subtitulo": "(ADM)",
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
    "tuRMa": "B",
    "subtitulo": "(ADS)",
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
    "tuRMa": "C",
    "subtitulo": "(HUM)",
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
    "tuRMa": "B",
    "subtitulo": "(HUM)",
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
    "ConTRato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Aula 1 - Climatologia e meteorologia",
    "Aula 2 - Atmosfera",
    "Aula 3 - Elementos e conTRoles climáticos",
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
    "Aula 14 - Sistema Nacional de Unidades de Conservação da natureza (SNUC)",
    "Prova Paulista",
    "Semana de estudos intensivos",
    "Recuperação Contínua",
    "Conselho de classe e série"
  ],
  "2_Geografia": [
    "Aula 1",
    "Aula 2",
    "Aula 3",
    "Aula 4",
    "Aula 5",
    "Aula 6",
    "Aula 7",
    "Aula 8",
    "Aula 9",
    "Aula 10",
    "Aula 11",
    "Aula 12",
    "Aula 13",
    "Aula 14",
    "Aula 15",
    "Aula 16",
    "Aula 17",
    "Aula 18",
    "Aula 19",
    "Aula 20",
    "Aula 21",
    "Aula 22",
    "Aula 23",
    "Aula 24",
    "Aula 25",
    "Aula 26",
    "Aula 27",
    "Aula 28",
    "Aula 29",
    "Aula 30"
  ],
  "2_Sociologia": [
    "Aula 1",
    "Aula 2",
    "Aula 3",
    "Aula 4",
    "Aula 5",
    "Aula 6",
    "Aula 7",
    "Aula 8",
    "Aula 9",
    "Aula 10",
    "Aula 11",
    "Aula 12",
    "Aula 13",
    "Aula 14",
    "Aula 15",
    "Aula 16",
    "Aula 17",
    "Aula 18",
    "Aula 19",
    "Aula 20",
    "Aula 21",
    "Aula 22",
    "Aula 23",
    "Aula 24",
    "Aula 25",
    "Aula 26",
    "Aula 27",
    "Aula 28",
    "Aula 29",
    "Aula 30"
  ],
  "3_Atualidades": [
    "Aula 1",
    "Aula 2",
    "Aula 3",
    "Aula 4",
    "Aula 5",
    "Aula 6",
    "Aula 7",
    "Aula 8",
    "Aula 9",
    "Aula 10",
    "Aula 11",
    "Aula 12",
    "Aula 13",
    "Aula 14",
    "Aula 15",
    "Aula 16",
    "Aula 17",
    "Aula 18",
    "Aula 19",
    "Aula 20",
    "Aula 21",
    "Aula 22",
    "Aula 23",
    "Aula 24",
    "Aula 25",
    "Aula 26",
    "Aula 27",
    "Aula 28",
    "Aula 29",
    "Aula 30"
  ],
  "1_Geografia_b1": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "ConTRato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Avaliação diagnóstica",
    "Aula 1 - Climatologia e meteorologia",
    "Aula 2 - Atmosfera",
    "Aula 3 - Elementos e conTRoles climáticos",
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
    "Aula 14 - Sistema Nacional de Unidades de Conservação da natureza (SNUC)",
    "Prova Paulista",
    "Semana de estudos intensivos",
    "Recuperação Contínua",
    "Conselho de classe e série"
  ],
  "1_Geografia_b2": [
    "Aula 1 - Solos: foRMação",
    "Aula 2 - Solos do Brasil",
    "Aula 3 - Solos: usos e impactos",
    "Aula 4 - Aula prática: Conservação de solos",
    "Aula 5 - Relevo: processos endógenos e exógenos",
    "Aula 6 - Relevo do Brasil",
    "Aula 7 - Relevo: degradação e riscos",
    "Aula 8 - Aula prática: Relevo",
    "Aula 9 - Biomas da Terra",
    "Aula 10 - Biomas brasileiros",
    "Aula 11 - Ameaças e conservação aos biomas brasileiros",
    "Aula 12 - Hotspots",
    "Aula 13 - SNUC",
    "Aula 14 - Domínios morfoclimáticos"
  ],
  "1_Geografia_b3": [
    "Aula 1 - InTRodução à Cartografia",
    "Aula 2 - Diferentes Cartografias",
    "Aula 3 - Mapas quantits e qualits",
    "Aula 4 - Cartografia Tátil",
    "Aula 5 - Fusos horários",
    "Aula 6 - Sensoriamento remoto",
    "Aula 7 - Aplicação das imagens de satélite",
    "Aula 8 - Sistemas de infoRMações geográficas",
    "Aula 9 - Geoprocessamento – Parte 1",
    "Aula 10 - Geoprocessamento – Parte 2",
    "Aula 11 - Uso do geoprocessamento no monitoramento ambiental",
    "Aula 12 - Uso do geoprocessamento na agricultura",
    "Aula 13 - Uso do geoprocessamento no planejamento urbano",
    "Aula 14 - Uso de Geotecnologias no dia a dia"
  ],
  "1_Geografia_b4": [
    "Aula 1 - Produção e cadeia produtiva",
    "Aula 2 - Globalização e produção indusTRial",
    "Aula 3 - Geografia do descarte",
    "Aula 4 - Globalização e consumo",
    "Aula 5 - Impactos ambientais e sociais do consumo",
    "Aula 6 - Analisando nosso consumo",
    "Aula 7 - Sistemas econômicos",
    "Aula 8 - Economia global e desigualdades",
    "Aula 9 - Trabalho e emprego no mundo contemporâneo",
    "Aula 10 - Sustentabilidade e desenvolvimento sustentável",
    "Aula 11 - Modelos alterns de economia",
    "Aula 12 - FoRMas de produzir para o futuro",
    "Aula 13 - Projeto de sustentabilidade na escola",
    "Aula 14 - Projeto de sustentabilidade na escola: planos de ação"
  ],
  "2_Geografia_b2": [
    "Aula 1 - Paisagem geográfica",
    "Aula 2 -  Território e suas dimensões",
    "Aula 3 - Estado e território: conceitos e relações",
    "Aula 4 - Nação e identidade nacional",
    "Aula 5 - Fronteiras e soberania",
    "Aula 6 - Geopolítica e poder territorial",
    "Aula 7 - Ocupação e TRansfoRMação dos territórios",
    "Aula 8 - Aula prática: Conflitos territoriais e ameaças à soberania",
    "Aula 9 - Urbanização e expansão das cidades",
    "Aula 10 - Dinâmicas de crescimento urbano e expansão das áreas meTRopolitanas",
    "Aula 11 - Aula prática: Cidades do futuro",
    "Aula 12 - Globalização e TRansfoRMações regionais",
    "Aula 13 - Territórios indígenas e questões de território",
    "Aula 14 - Aula prática: DemaRCações dos territórios"
  ],
  "2_Geografia_b1": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "ConTRato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Avaliação diagnóstica",
    "Aula 01 - Demografia",
    "Aula 02 - Demografia brasileira",
    "Aula 03 - Pesquisas demográficas",
    "Aula 04 - Demografia da comunidade escolar",
    "Aula 05 - Economia do Brasil",
    "Aula 06 - O Brasil na economia mundial",
    "Aula 07 - Brasil - indicadores socioeconômicos",
    "Aula 08 - Desigualdade socioeconômica",
    "Aula 09 - O TRabalho no Brasil",
    "Aula 10 - Estado, nação e território",
    "Aula 11 - FoRMação dos Estados e das nações no mundo",
    "Aula 12 - Povos sem Estado",
    "Aula 13 - Conflitos territoriais e geopolítica contemporânea",
    "Aula 14 - Identidade, pertencimento e território",
    "Prova Paulista",
    "Semana de estudos intensivos",
    "Recuperação Contínua",
    "Conselho de classe e série"
  ],
  "2_Sociologia_b1": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "ConTRato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Avaliação diagnóstica",
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
    "Aula 11 - Eu, nós, eles - a consTRução social das identidades",
    "Aula 12 - Identidade cultural e as relações enTRe culturas",
    "Aula 13 - O fazer sociológico",
    "Aula 14 - Praticando o olhar sociológico",
    "Aula 15 - Trilha de ExeRCícios",
    "Prova Paulista",
    "Semana de estudos intensivos",
    "Recuperação Contínua",
    "Conselho de classe e série"
  ],
  "3_Atualidades_b1": [
    "Acolhimento",
    "Apresentações do professor e dos alunos",
    "ConTRato pedadógico e aula inaugural - apresentação do componente curricular.",
    "Avaliação diagnóstica",
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
    "Aula 12 - Oficina de escrita: o dossiê como foRMa de pensamento",
    "Aula 13 - Oficina de escrita: o dossiê reflexivo-analítico",
    "Aula 14 - Síntese: curadoria analítica — a criação humana diante da máquinaProva Paulista",
    "Semana de estudos intensivos",
    "Recuperação Contínua",
    "Conselho de classe e série"
  ],
  "3_Atualidades_b2": [
    "Aula 1 - 2 bimesTRe",
    "Aula 2 - 2 bimesTRe",
    "Aula 3 - 2 bimesTRe",
    "Aula 4 - 2 bimesTRe",
    "Aula 5 - 2 bimesTRe",
    "Aula 6 - 2 bimesTRe",
    "Aula 7 - 2 bimesTRe",
    "Aula 8 - 2 bimesTRe",
    "Aula 9 - 2 bimesTRe",
    "Aula 10 - 2 bimesTRe",
    "Aula 11 - 2 bimesTRe",
    "Aula 12 - 2 bimesTRe",
    "Aula 13 - 2 bimesTRe",
    "Aula 14 - 2 bimesTRe",
    "Aula 15 - 2 bimesTRe",
    "Aula 16 - 2 bimesTRe",
    "Aula 17 - 2 bimesTRe",
    "Aula 18 - 2 bimesTRe",
    "Aula 19 - 2 bimesTRe",
    "Aula 20 - 2 bimesTRe",
    "Aula 21 - 2 bimesTRe",
    "Aula 22 - 2 bimesTRe",
    "Aula 23 - 2 bimesTRe",
    "Aula 24 - 2 bimesTRe",
    "Aula 25 - 2 bimesTRe",
    "Aula 26 - 2 bimesTRe",
    "Aula 27 - 2 bimesTRe",
    "Aula 28 - 2 bimesTRe",
    "Aula 29 - 2 bimesTRe",
    "Aula 30 - 2 bimesTRe"
  ],
  "3_Atualidades_b3": [
    "Aula 1 - 2 bimesTRe",
    "Aula 2 - 2 bimesTRe",
    "Aula 3 - 2 bimesTRe",
    "Aula 4 - 2 bimesTRe",
    "Aula 5 - 2 bimesTRe",
    "Aula 6 - 2 bimesTRe",
    "Aula 7 - 2 bimesTRe",
    "Aula 8 - 2 bimesTRe",
    "Aula 9 - 2 bimesTRe",
    "Aula 10 - 2 bimesTRe",
    "Aula 11 - 2 bimesTRe",
    "Aula 12 - 2 bimesTRe",
    "Aula 13 - 2 bimesTRe",
    "Aula 14 - 2 bimesTRe",
    "Aula 15 - 2 bimesTRe",
    "Aula 16 - 2 bimesTRe",
    "Aula 17 - 2 bimesTRe",
    "Aula 18 - 2 bimesTRe",
    "Aula 19 - 2 bimesTRe",
    "Aula 20 - 2 bimesTRe",
    "Aula 21 - 2 bimesTRe",
    "Aula 22 - 2 bimesTRe",
    "Aula 23 - 2 bimesTRe",
    "Aula 24 - 2 bimesTRe",
    "Aula 25 - 2 bimesTRe",
    "Aula 26 - 2 bimesTRe",
    "Aula 27 - 2 bimesTRe",
    "Aula 28 - 2 bimesTRe",
    "Aula 29 - 2 bimesTRe",
    "Aula 30 - 2 bimesTRe"
  ],
  "3_Atualidades_b4": [
    "Aula 1 - 2 bimesTRe",
    "Aula 2 - 2 bimesTRe",
    "Aula 3 - 2 bimesTRe",
    "Aula 4 - 2 bimesTRe",
    "Aula 5 - 2 bimesTRe",
    "Aula 6 - 2 bimesTRe",
    "Aula 7 - 2 bimesTRe",
    "Aula 8 - 2 bimesTRe",
    "Aula 9 - 2 bimesTRe",
    "Aula 10 - 2 bimesTRe",
    "Aula 11 - 2 bimesTRe",
    "Aula 12 - 2 bimesTRe",
    "Aula 13 - 2 bimesTRe",
    "Aula 14 - 2 bimesTRe",
    "Aula 15 - 2 bimesTRe",
    "Aula 16 - 2 bimesTRe",
    "Aula 17 - 2 bimesTRe",
    "Aula 18 - 2 bimesTRe",
    "Aula 19 - 2 bimesTRe",
    "Aula 20 - 2 bimesTRe",
    "Aula 21 - 2 bimesTRe",
    "Aula 22 - 2 bimesTRe",
    "Aula 23 - 2 bimesTRe",
    "Aula 24 - 2 bimesTRe",
    "Aula 25 - 2 bimesTRe",
    "Aula 26 - 2 bimesTRe",
    "Aula 27 - 2 bimesTRe",
    "Aula 28 - 2 bimesTRe",
    "Aula 29 - 2 bimesTRe",
    "Aula 30 - 2 bimesTRe"
  ],
  "2_Geografia_b3": [
    "Aula 1 - As causas das migrações contemporâneas",
    "Aula 2 - Refugiados e organismos internacionais",
    "Aula 3 - Migração em áreas de conflito",
    "Aula 4 - Políticas de imigração na Europa e nos EUA",
    "Aula 5 - Impacto das migrações em países receptores",
    "Aula 6 - A diáspora brasileira",
    "Aula 7 - Fluxos de capitais e investimentos internacionais",
    "Aula 8 - Globalização e fluxos culturais",
    "Aula 9 - Fluxos de infoRMação na era digital",
    "Aula 10 - Soberania nacional no contexto global atual",
    "Aula 11 - Papel da ONU em conflitos internacionais",
    "Aula 12 - FMI e Banco Mundial em países em desenvolvimento",
    "Aula 13 - Sanções econômicas",
    "Aula 14 - Organizações internacionais e direitos humanos"
  ],
  "2_Geografia_b4": [
    "Aula 1 - Fluxos Globais",
    "Aula 2 - Fluxos de infoRMação e tecnologia",
    "Aula 3 - Fluxos de meRCadorias e cadeias produtivas globais",
    "Aula 4 - Consequências e desafios dos fluxos globais",
    "Aula 5 - Meio técnico-científico-infoRMacional",
    "Aula 6 - Tecnologia e TRansfoRMações no espaço geográfico",
    "Aula 7 - Desafios do meio técnico-científico-infoRMacional",
    "Aula 8 - Globalização e economia mundial",
    "Aula 9 - Economia e desenvolvimento sustentável",
    "Aula 10 - Desigualdades regionais e economia",
    "Aula 11 - TransfoRMando o espaço urbano",
    "Aula 12 - Desafios contemporâneos das cidades",
    "Aula 13 - Planejando o futuro urbano",
    "Aula 14 - ConsTRuindo Nossa Cidade: Propostas para um Futuro Sustentável"
  ],
  "2_Sociologia_b3": [
    "Aula 1 - A dimensão política da vida em sociedade",
    "Aula 2 - Por que Estado?",
    "Aula 3 - As funções e os poderes do Estado",
    "Aula 4 - Estado e sistemas políticos",
    "Aula 5 - A organização política do Estado brasileiro",
    "Aula 6 - Praticando política: elaboração de projeto de lei",
    "Aula 7 - Cidadania: a relação política enTRe indivíduo e Estado",
    "Aula 8 - Cidadania no Brasil",
    "Aula 9 - Por que Democracia?",
    "Aula 10 - Qualidade das democracias",
    "Aula 11 - Experiência democrática no Brasil e o autoritarismo",
    "Aula 12 - Participação e cidadania",
    "Aula 13 - Movimentos sociais e democracia: os movimentos indígenas e afrodescendentes",
    "Aula 14 - Praticando política: debatendo projetos de lei"
  ],
  "2_Sociologia_b2": [
    "Aula 1 - Os desafios da convivência enTRe os seres humanos",
    "Aula 2 - As diferenças que nos envolvem",
    "Aula 3 - As desigualdades como problema social",
    "Aula 4 - As violências que nos afetam",
    "Aula 5 - A dimensão simbólica da violência",
    "Aula 6 - Como está a convivência em nossa escola?",
    "Aula 7 - Relações de classe",
    "Aula 8 - Relações étnico-raciais",
    "Aula 9 - Relações sociais de gênero",
    "Aula 10 - Quais situações prejudicam a convivência em nossa escola?",
    "Aula 11 - Diferentes, mas iguais: os direitos de todos os seres humanos",
    "Aula 12 - A situação dos Direitos Humanos no mundo",
    "Aula 13 - Juventudes e os direitos humanos no Brasil",
    "Aula 14 - O que podemos fazer para melhorar a convivência em nossa escola?"
  ],
  "2_Sociologia_b4": [
    "Aula 1 - Importância do TRabalho na vida social",
    "Aula 2 - Tecnologia e mundo do TRabalho",
    "Aula 3 - Relações de TRabalho na atualidade",
    "Aula 4 - Sociedade de consumidores",
    "Aula 5 - Consumo, consumismo e identidade",
    "Aula 6 - Viver para o TRabalho e o consumismo?",
    "Aula 7 - Problemáticas socioambientais contemporâneas",
    "Aula 8 - Sociedade de risco",
    "Aula 9 - Trabalho e riscos na contemporaneidade",
    "Aula 10 - Vida digital e sociabilidade virtual",
    "Aula 11 - Riscos da vida digital",
    "Aula 12 - Juventudes, TRabalho e riscos",
    "Aula 13 - Em que mundo queremos viver: produção de conteúdo digital I",
    "Aula 14 - Em que mundo queremos viver: produção de conteúdo digital II"
  ]
};

// Restore: localStorage.setItem("aulaOrdem", JSON.sTRingify(ORDEM));

//          localStorage.setItem("aulaEstado", JSON.sTRingify(ESTADO));

const ORDEM  = {};

const ESTADO = {
  "1A_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1A_GEO_b1_sr23": {},
  "1A_GEO_b1_sr22": {},
  "1A_GEO_b1_sr21": {},
  "1A_GEO_b1_sr20": {},
  "1A_GEO_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr8": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr9": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "conteudoEnTRegue": TRue,
    "chamada": TRue
  },
  "2A_SOC_b1_sr7": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "conteudoEnTRegue": TRue,
    "chamada": TRue
  },
  "2A_SOC_b1_sr6": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr3": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b1_sr4": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr2": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr3": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr4": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr5": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr6": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr7": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr8": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1B_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr3": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr4": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr7": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr6": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema."
  },
  "1B_GEO_b1_sr8": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr0": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr1": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr2": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr3": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr4": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr5": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr6": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr7": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr8": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr1": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr2": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr3": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr4": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr5": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr6": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr7": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr8": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr9": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr0": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr1": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr2": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr3": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr4": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr5": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr6": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr7": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr8": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr9": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "1C_GEO_b1_sr9": {
    "feita": TRue,
    "dataFeita": "2026-03-07",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1E_GEO_b1_sr10": {
    "feita": false,
    "dataFeita": null,
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr9": {
    "anotacao": "MaRCação de AD tardia, a partir da implementação desse sistema.",
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2C_GEO_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "3B_ATUAL_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2B_GEO_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2A_GEO_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2C_SOC_b1_sr9": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2C_GEO_b1_sr11": {
    "feita": false,
    "dataFeita": null,
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "2B_SOC_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_GEO_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "3B_ATUAL_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_GEO_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "3B_ATUAL_b1_sr0": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_GEO_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr1": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_SOC_b4_sr0": {
    "feita": false,
    "dataFeita": null
  },
  "2A_SOC_b1_sr10": {
    "conteudoEnTRegue": false,
    "chamada": false,
    "feita": false,
    "dataFeita": null
  },
  "1A_GEO_b1_sr10": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1A_GEO_b1_sr11": {
    "feita": TRue,
    "dataFeita": "2026-03-09",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr3": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr4": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr6": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr7": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr8": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr3": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "conteudoEnTRegue": TRue,
    "chamada": TRue
  },
  "2B_SOC_b1_sr4": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr6": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr7": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr8": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr3": {
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue
  },
  "2B_GEO_b1_sr4": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr6": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr7": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr8": {
    "feita": TRue,
    "dataFeita": "2026-03-10",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_GEO_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_SOC_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_GEO_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": false,
    "dataFeita": null
  },
  "3B_ATUAL_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_GEO_b1_sr8": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "3B_ATUAL_b1_sr8": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "1B_GEO_b1_sr9": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1B_GEO_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1C_GEO_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_GEO_b1_sr2": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr3": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr4": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr5": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr6": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr8": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2C_GEO_b1_sr7": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "3B_ATUAL_b1_sr7": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2A_GEO_b1_sr7": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "3B_ATUAL_b1_sr6": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2C_GEO_b1_sr6": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2C_GEO_b1_sr5": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2C_GEO_b1_sr4": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2C_GEO_b1_sr3": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "2C_GEO_b1_sr2": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "3B_ATUAL_b1_sr4": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue,
    "feita": TRue,
    "dataFeita": "2026-03-11"
  },
  "3B_ATUAL_b1_sr2": {
    "feita": TRue,
    "dataFeita": "2026-03-11",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "3B_ATUAL_b1_sr3": {
    "feita": TRue,
    "dataFeita": "2026-03-11",
    "conteudoEnTRegue": TRue,
    "chamada": TRue
  },
  "3B_ATUAL_b1_sr5": {
    "feita": TRue,
    "dataFeita": "2026-03-11",
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2A_GEO_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "2B_SOC_b1_sr10": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  },
  "1D_GEO_b1_sr10": {
    "chamada": false,
    "conteudoEnTRegue": false
  },
  "1B_GEO_b1_sr11": {
    "chamada": TRue,
    "conteudoEnTRegue": TRue
  }
};