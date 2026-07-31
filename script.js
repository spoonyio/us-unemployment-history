// Main state object to hold the current scene and data
const state = {
    currentScene: 0,
    data: [],
    recessions: []
};

// Scene configurations with titles, subtitles, xDomain, and annotations
const scenes = [
    {
        title: "Scene 1: Baseline conditions and Dot-Com Shock (1990–2006)",
        subtitle: "Following the early 1990s recession, the US labor market expanded steadily to hit a low of 3.8% in April 2000. The 2001 Dot-Com market crash and 9/11 shock led to a relatively mild recession where unemployment peaked at 6.3% (June 2003) before recovering quickly.",
        xDomain: [new Date("1990-01-01"), new Date("2006-12-31")],
        annotations: [
            {
                note: {
                    title: "6.3% - June 2003",
                    label: "Mild peak after Dot-Com bust.",
                    wrap: 180
                },
                date: new Date("2003-06-01"),
                rate: 6.3,
                dx: 10,
                dy: -40
            },
            {
                note: {
                    title: "3.8% - April 2000",
                    label: "Lowest unemployment of 1990s tech boom.",
                    wrap: 180
                },
                date: new Date("2000-04-01"),
                rate: 3.8,
                dx: -20,
                dy: -55
            }

        ]
    },
    {
        title: "Scene 2: The 2008 Great Recession (2007–2018)",
        subtitle: "A 2 year climb to 10% unemployment resulted in systemic damage that took nearly 8 years to fully heal.",
        xDomain: [new Date("2007-01-01"), new Date("2018-12-31")],
        annotations: [
            {
                note: {
                    title: "10% - October 2009",
                    label: "Unemployment hits the worst downturn since the 1980s.",
                    wrap: 200
                },
                date: new Date("2009-10-01"),
                rate: 10.0,
                dx: 40,
                dy: -30
            },
            {
                note: {
                    title: "4.4% - April 2017",
                    label: "Took nearly 8 years to fully heal.",
                    wrap: 200
                },
                date: new Date("2017-04-01"),
                rate: 4.4,
                dx: -5,
                dy: -55
            }
        ]
    },
    {
        title: "Scene 3: The COVID-19 Pandemic (2019–2022)",
        subtitle: "A vertical spike to 14.8% unemployment in April 2020 was followed by a rapid 2 year rebound back to historical lows.",
        xDomain: [new Date("2019-01-01"), new Date("2022-12-31")],
        annotations: [
            {
                note: {
                    title: "3.5% - February 2020",
                    label: "50 year low prior to the pandemic.",
                    wrap: 200
                },
                date: new Date("2020-02-01"),
                rate: 3.5,
                dx: -15,
                dy: -20
            },
            {
                note: {
                    title: "14.8% - April 2020 Spike",
                    label: "The highest unemployment rate recorded since the Great Depression.",
                    wrap: 200
                },
                date: new Date("2020-04-01"),
                rate: 14.8,
                dx: 60,
                dy: 20
            },
            {
                note: { 
                    title: "3.9% - December 2021", 
                    label: "Rapid rebound back to pre-pandemic levels in under 2 years.", 
                    wrap: 180 
                },
                date: new Date("2021-12-01"),
                rate: 3.9,
                dx: 30,
                dy: -40
            }
        ]
    },
    {
        title: "Scene 4: Full Exploration (1990–Present)",
        subtitle: "Explore the entire 1990–Present timeline.",
        xDomain: null,
        annotations: []
    }
];

// Set up SVG canvas dimensions and margins
const margin = { top: 30, right: 30, bottom: 40, left: 50 };
const width = 800 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Append SVG to the chart container
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Create DOM layers in z-index order (bottom to top)
const recessionGroup = svg.append("g").attr("class", "recessions");
const xAxisGroup = svg.append("g").attr("transform", `translate(0, ${height})`);
const yAxisGroup = svg.append("g");
const pathGroup = svg.append("path").attr("class", "line").attr("fill", "none").attr("stroke", "#0056b3").attr("stroke-width", 2.5);
const annotationGroup = svg.append("g").attr("class", "annotation-group");

// Hover tooltip container
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "8px 12px")
    .style("background", "rgba(0,0,0,0.85)")
    .style("color", "#fff")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0);

// Define linear and time scales
const x = d3.scaleTime().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);
const parseDate = d3.timeParse("%Y-%m-%d");

// Converts binary 0/1 recession flags into date ranges
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

// Load both CSV files in parallel and process the data
Promise.all([
    d3.csv("UNRATE.csv", d => {
        const rawDate = d.observation_date || d.DATE;
        const rawRate = d.UNRATE;
        if (!rawRate || rawRate.trim() === "") return null;
        return { date: parseDate(rawDate), rate: +rawRate };
    }),
    d3.csv("USREC.csv")
]).then(([unrateData, usrecData]) => {
    // Clean and store unemployment data, filtering out invalid entries
    state.data = unrateData
        .filter(d => d !== null && d.date !== null && !isNaN(d.rate) && d.date >= new Date("1990-01-01"));
    if (state.data.length === 0) throw new Error("No valid data parsed.");

    // Process recession date ranges from the USREC dataset
    state.recessions = processRecessions(usrecData);

    // Set Scene 4 (last scene) to full data extent
    scenes[3].xDomain = d3.extent(state.data, d => d.date);

    // Set initial scales and axes
    y.domain([0, d3.max(state.data, d => d.rate) + 2]);
    yAxisGroup.call(d3.axisLeft(y).tickFormat(d => d + "%"));

    d3.select("#status")
        .attr("class", "success")
        .html(`Successfully loaded ${state.data.length} unemployment records & ${state.recessions.length} recession windows.`);

    d3.select("#btn-next").on("click", () => changeScene(1));
    d3.select("#btn-prev").on("click", () => changeScene(-1));

    setupLineHover();
    renderScene();

}).catch(error => {
    console.error("Error loading CSV files:", error);
    d3.select("#status")
        .attr("class", "error")
        .html("Failed to load data. Check console log for details.");
});

// Change the current scene based on direction (-1 for previous, +1 for next)
function changeScene(direction) {
    state.currentScene += direction;
    state.currentScene = Math.max(0, Math.min(state.currentScene, scenes.length - 1));
    renderScene();
}

// Render the current scene with transitions and annotations
function renderScene() {
    const current = scenes[state.currentScene];
    const t = d3.transition().duration(800).ease(d3.easeCubicInOut);

    d3.select("#scene-title").text(current.title);
    d3.select("#scene-subtitle").text(current.subtitle);
    d3.select("#btn-prev").property("disabled", state.currentScene === 0);
    d3.select("#btn-next").property("disabled", state.currentScene === scenes.length - 1);
    d3.selectAll(".step-dot").classed("active", (d, i) => i === state.currentScene);

    const activeDomain = current.xDomain || d3.extent(state.data, d => d.date);

    // Hide tracking dot on scene transition
    focusDot.style("opacity", 0);

    // Update x-axis domain and animate transition
    x.domain(activeDomain);
    xAxisGroup.transition(t).call(d3.axisBottom(x));

    // Animate line path transition to new domain
    const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.rate));

    pathGroup
        .datum(state.data)
        .transition(t)
        .attr("d", lineGenerator);

    // Hide recession bands during pan transition
    recessionGroup.selectAll(".recession-band").style("opacity", 0);

    // Fade in recession bands after transition finishes
    t.end().then(() => {
        const visibleRecessions = state.recessions.filter(r =>
            r.end >= activeDomain[0] && r.start <= activeDomain[1]
        );

        const formatDate = d3.timeFormat("%B %Y");

        const bands = recessionGroup.selectAll(".recession-band")
            .data(visibleRecessions, d => d.start);

        bands.exit().remove();

        const bandsEnter = bands.enter()
            .append("rect")
            .attr("class", "recession-band")
            .attr("y", 0)
            .attr("height", height)
            .style("cursor", "pointer")
            .style("pointer-events", "all");

        // Merge enter and update selections for recession bands
        bandsEnter.merge(bands)
            .attr("x", d => x(d.start))
            .attr("width", d => Math.max(0, x(d.end) - x(d.start)))
            .attr("fill", "#212529")
            .style("opacity", 0)
            .on("mouseover", function (event, d) {
                event.stopPropagation();
                focusDot.style("opacity", 0);
                d3.select(this).attr("fill", "#495057").style("opacity", 0.3);
                tooltip
                    .style("opacity", 0.95)
                    .html(`<strong>NBER Official U.S. Recession</strong><br/>` +
                        `Period: <strong>${formatDate(d.start)} – ${formatDate(d.end)}</strong>`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mousemove", function (event) {
                event.stopPropagation();
                tooltip
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("fill", "#212529").style("opacity", 0.12);
                tooltip.style("opacity", 0);
            })
            .transition().duration(300)
            .style("opacity", 0.12);
    });

    renderAnnotations(current.annotations, t);
}

// Render annotations for the current scene with hover interactions
function renderAnnotations(annotationList, transition) {
    annotationGroup.html("");

    if (!annotationList || annotationList.length === 0) return;

    // Format annotations for d3-annotation library
    const formattedAnnotations = annotationList.map(a => ({
        note: a.note,
        x: x(a.date),
        y: y(a.rate),
        dx: a.dx,
        dy: a.dy,
        type: d3.annotationCalloutCircle,
        subject: { radius: 8, radiusPadding: 2 }
    }));

    const makeAnnotations = d3.annotation()
        .type(d3.annotationLabel)
        .annotations(formattedAnnotations);

    // Append annotation SVG elements
    annotationGroup.call(makeAnnotations);

    // Add hover interactions for annotations
    annotationGroup.selectAll(".annotation")
        .style("cursor", "pointer")
        .on("mouseover", function () {
            const ann = d3.select(this);

            // Fill in the circle dot on line
            ann.select(".subject")
                .transition().duration(150)
                .style("fill", "#0056b3")
                .style("fill-opacity", 1)
                .style("stroke-width", "3px");

            // Highlight title text
            ann.select(".annotation-note-title")
                .transition().duration(150)
                .style("fill", "#003d80");

            // Highlight label body text
            ann.select(".annotation-note-label")
                .transition().duration(150)
                .style("fill", "#111111");
        })
        .on("mouseout", function () {
            const ann = d3.select(this);

            // Return circle dot to outline
            ann.select(".subject")
                .transition().duration(200)
                .style("fill", "none")
                .style("fill-opacity", 0)
                .style("stroke-width", "2px");

            // Reset text styling
            ann.select(".annotation-note-title")
                .transition().duration(200)
                .style("fill", null)
                .style("font-size", null);

            ann.select(".annotation-note-label")
                .transition().duration(200)
                .style("fill", null);
        });

    // Fade in annotations after transition
    annotationGroup
        .style("opacity", 0)
        .transition()
        .duration(600)
        .delay(400)
        .style("opacity", 1);
}

// Create a focus dot that follows the line on hover
const focusDot = svg.append("circle")
    .attr("class", "focus-dot")
    .attr("r", 5)
    .attr("fill", "#0056b3")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 2)
    .style("opacity", 0)
    .style("pointer-events", "none");

// Set up hover interactions for the line chart
function setupLineHover() {
    const bisectDate = d3.bisector(d => d.date).left;

    // Insert overlay before recessionGroup in DOM order
    const overlay = svg.insert("rect", ".recessions")
        .attr("class", "chart-overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all");

    overlay.on("mousemove", function (event) {
        // Check if mouse is over a recession band
        const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
        if (hoveredElement && hoveredElement.classList.contains("recession-band")) {
            focusDot.style("opacity", 0);
            return; // Let the recession band hover handle tooltip
        }

        const currentDomain = scenes[state.currentScene].xDomain;
        const activeDomain = currentDomain || d3.extent(state.data, d => d.date);
        const x0 = x.invert(d3.pointer(event, this)[0]);

        // Filter data visible within active domain
        const visibleData = state.data.filter(d => d.date >= activeDomain[0] && d.date <= activeDomain[1]);
        if (visibleData.length === 0) return;

        // Find nearest data point to cursor date
        const i = bisectDate(visibleData, x0, 1);
        const d0 = visibleData[i - 1];
        const d1 = visibleData[i];
        const d = (d1 && (x0 - d0.date > d1.date - x0)) ? d1 : d0;

        if (!d) return;

        // Position tracking dot on line point
        focusDot
            .style("opacity", 1)
            .attr("cx", x(d.date))
            .attr("cy", y(d.rate));

        // Show line tooltip
        tooltip
            .style("opacity", 0.95)
            .html(`<strong>${d3.timeFormat("%B %Y")(d.date)}</strong><br/>Unemployment Rate: <strong>${d.rate}%</strong>`)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    })
        .on("mouseout", function () {
            focusDot.style("opacity", 0);
            tooltip.style("opacity", 0);
        });
}