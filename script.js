const state = {
  currentScene: 0,
  data: [],
  recessions: []
};

const scenes = [
  {
    title: "Scene 1: Dot-Com Bubble (1990–2006)",
    subtitle: "Baseline labor market conditions and mild structural downturns.",
    xDomain: [new Date("1990-01-01"), new Date("2006-12-31")]
  },
  {
    title: "Scene 2: The 2008 Great Recession (2007–2018)",
    subtitle: "A deep financial crisis causing arise to 10% unemployment, followed by a slow recovery.",
    xDomain: [new Date("2007-01-01"), new Date("2018-12-31")]
  },
  {
    title: "Scene 3: The 2020 COVID-19 Pandemic (2019–2022)",
    subtitle: "A spike to 14.8% followed by a rapid rebound.",
    xDomain: [new Date("2019-01-01"), new Date("2022-12-31")]
  },
  {
    title: "Scene 4: Full Exploration (1990–Present)",
    subtitle: "Compare all economic shocks across the entire 1990–Present timeline.",
    xDomain: null
  }
];


const margin = { top: 30, right: 30, bottom: 40, left: 50 };
const width = 800 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const recessionGroup = svg.append("g").attr("class", "recessions");

const x = d3.scaleTime().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

const xAxisGroup = svg.append("g").attr("transform", `translate(0, ${height})`);
const yAxisGroup = svg.append("g");
const pathGroup = svg.append("path").attr("class", "line").attr("fill", "none").attr("stroke", "#0056b3").attr("stroke-width", 2.5);
    
const parseDate = d3.timeParse("%Y-%m-%d");

function processRecessions(rawUsrec) {
  const filtered = rawUsrec
    .map(d => ({
      date: parseDate(d.observation_date || d.DATE),
      isRecession: +d.USREC === 1
    }))
    .filter(d => d.date !== null && d.date >= new Date("1990-01-01"))
    .sort((a, b) => a.date - b.date);

  const ranges = [];
  let currentStart = null;

  filtered.forEach(row => {
    if (row.isRecession && !currentStart) {
      currentStart = row.date;
    } else if (!row.isRecession && currentStart) {
      ranges.push({ start: currentStart, end: row.date });
      currentStart = null;
    }
  });

  if (currentStart) {
    ranges.push({ start: currentStart, end: filtered[filtered.length - 1].date });
  }

  return ranges;
}

Promise.all([
    d3.csv("UNRATE.csv", d => {
        const rawDate = d.observation_date || d.DATE;
        const rawRate = d.UNRATE;
        if (!rawRate || rawRate.trim() === "") return null;
        return { date: parseDate(rawDate), rate: +rawRate };
    }),
    d3.csv("USREC.csv")
    ]).then(([unrateData, usrecData]) => {
    state.data = unrateData
        .filter(d => d !== null && d.date !== null && !isNaN(d.rate) && d.date >= new Date("1990-01-01"));
    
    if (state.data.length === 0) throw new Error("No valid data parsed.");

    state.recessions = processRecessions(usrecData);

    // Default full domain for Scene 4 based on the entire dataset
    scenes[3].xDomain = d3.extent(state.data, d => d.date);

    y.domain([0, d3.max(state.data, d => d.rate) + 2]);
    yAxisGroup.call(d3.axisLeft(y).tickFormat(d => d + "%"));

    d3.select("#status")
        .attr("class", "success")
        .html(`Successfully loaded ${state.data.length} unemployment records & ${state.recessions.length} recession windows.`);

    d3.select("#btn-next").on("click", () => changeScene(1));
    d3.select("#btn-prev").on("click", () => changeScene(-1));
    
    renderScene();

}).catch(error => {
    console.error("Error loading CSV files:", error);
    d3.select("#status")
        .attr("class", "error")
        .html("Failed to load data. Check console log for details.");
});

function changeScene(direction) {
    state.currentScene += direction;
    state.currentScene = Math.max(0, Math.min(state.currentScene, scenes.length - 1));
    renderScene();
}

function renderScene() {
    const current = scenes[state.currentScene];

    d3.select("#scene-title").text(current.title);
    d3.select("#scene-subtitle").text(current.subtitle);
    d3.select("#btn-prev").property("disabled", state.currentScene === 0);
    d3.select("#btn-next").property("disabled", state.currentScene === scenes.length - 1);
    d3.selectAll(".step-dot").classed("active", (d, i) => i === state.currentScene);

    x.domain(current.xDomain);
    xAxisGroup.call(d3.axisBottom(x));

    // Draw recession bands
    const visibleRecessions = state.recessions.filter(r => 
        r.end >= current.xDomain[0] && r.start <= current.xDomain[1]
    );

    const bands = recessionGroup.selectAll(".recession-band")
        .data(visibleRecessions, d => d.start);

    bands.enter()
        .append("rect")
        .attr("class", "recession-band")
        .merge(bands)
        .attr("x", d => x(d.start))
        .attr("width", d => Math.max(0, x(d.end) - x(d.start)))
        .attr("y", 0)
        .attr("height", height)
        .attr("fill", "#212529")
        .attr("opacity", 0.12);

    bands.exit().remove();

    // Draw unemployment rate line
    const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.rate));

    const visibleData = state.data.filter(d => d.date >= current.xDomain[0] && d.date <= current.xDomain[1]);

    pathGroup
        .datum(visibleData)
        .attr("d", lineGenerator);
}