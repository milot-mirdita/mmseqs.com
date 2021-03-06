Object.values = Object.values || (obj => Object.keys(obj).map(key => obj[key]));

var debounce = function(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

var tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
var link = tooltip.append("a").attr("target", "_blank");

function linechart(svg, hdiv, ylab, data) {
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight / hdiv);

    var margin = { top: 10, right: 120, bottom: 20, left: 50 };
    var width = window.innerWidth - margin.left - margin.right;
    var height = (window.innerHeight / hdiv) - margin.top - margin.bottom;
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    var x = d3.scaleTime().range([0, width]),
        y = d3.scaleLinear().range([height, 0]),
        z = d3.scaleOrdinal(d3.schemeCategory10);

    var line = d3.line()
        .curve(d3.curveStepAfter)
        .x(function (d) { return x(d.created); })
        .y(function (d) { return y(d.roc); });

    function render(names) {
        x.domain([
            d3.min(names, function (c) { return d3.min(c.values, function (d) { return d.created; }); }),
            d3.max(names, function (c) { return d3.max(c.values, function (d) { return d.created; }); })
        ]);

        var min = d3.min(names, function (c) { return d3.min(c.values, function (d) { return d.roc; }); });
        var max = d3.max(names, function (c) { return d3.max(c.values, function (d) { return d.roc; }); });
        y.domain([
            min - ((min+max)/2 * 0.1),
            max + ((min+max)/2 * 0.1)
        ]);

        z.domain(names.map(function (c) { return c.id; }));

        g.append("g")
            .attr("class", "axis axis--x")
            .call(d3.axisBottom(x))
            .attr("transform", "translate(0," + height + ")");

        g.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(y))
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", "0.71em")
            .attr("fill", "#000")
            .text(ylab);

        var regression = g.selectAll(".regression")
            .data(names)
            .enter().append("g")
            .attr("class", "regression");

        regression.append("path")
            .attr("class", "line")
            .attr("d", function (d) { return line(d.values); })
            .style("stroke", function (d) { return z(d.id); });

        regression.selectAll("dot")
            .data(names.map(function (d) { return d.values }).reduce(function (acc, val) { return acc.concat(val, []) }))
            .enter().append("circle")
            .attr("r", 3)
            .attr("cx", function (d) { return x(d.created); })
            .attr("cy", function (d) { return y(d.roc); })
            .style("fill", function (d) { return z(d.id); })
            .on("mouseover touchstart", function (d) {
                var x, y;
                if (typeof (d3.event) != "undefined") {
                    x = d3.event.pageX;
                    y = d3.event.pageY;
                } else if (typeof (d3.touches) != "undefined") {
                    x = d3.touches[0].pageX;
                    y = d3.touches[0].pageY;
                } else {
                    return false;
                }
                tooltip.transition()
                    .duration(100)
                    .style("opacity", 1)
                    .style("left", Math.max((x - 240), -30) + "px")
                    .style("top", (y - 28) + "px");

                link
                    .attr("href", "https://github.com/soedinglab/MMseqs2/commit/" + d.git)
                    .html(d.git);
            })
            // .on("mouseout touchend", function (d) {
            //     debounce(function() {
            //         tooltip.transition()
            //             .duration(100)
            //             .style("opacity", 0);
            //     }, 1000)();
            // });

        regression.append("text")
            .datum(function (d) { return { id: d.id, value: d.values[d.values.length - 1] }; })
            .attr("transform", function (d, i) {
                return "translate("
                    + x(d.value.created) + ","
                    + (y(d.value.roc) + (i % 2 ? 3 : -3)) + ")";
            })
            .attr("x", 3)
            .attr("dy", "0.35em")
            .style("font", "10px sans-serif")
            .text(function (d) { return d.id; });
    }

    var names = Object.values(data.map(function (id) {
        return {
            id: id.name,
            values: data.filter(function (d) {
                return d.name == id.name;
            }).map(function (d) {
                return { created: parseTime(d.created), roc: d.roc - 0, git: d.git };
            })
        };
    }).reduce(function (acc, val) {
        if (!acc.hasOwnProperty(val.id)) {
            acc[val.id] = { id : val.id, values : val.values}
        }
        return acc;
    }, []));

    render(names);

    window.addEventListener("resize", debounce(function() {
        svg.selectAll("*").remove();
        svg.attr("width", window.innerWidth).attr("height", window.innerHeight / hdiv);
        width = window.innerWidth - margin.left - margin.right;
        height = (window.innerHeight / hdiv) - margin.top - margin.bottom;
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
        tooltip.style("opacity", 0);

        x = d3.scaleTime().range([0, width]),
        y = d3.scaleLinear().range([height, 0]),

        render(names);
    }, 66, true));
}

d3.json("regression.php", function (error, data) {
    if (error) throw error;
    linechart(d3.select("svg#search"), 2, "ROC", data.filter(function (d) {
        return d.mode < 2 || d.mode == 9;
    }));

    linechart(d3.select("svg#clust"), 4, "# Clu.", data.filter(function (d) {
        return d.mode == 3 || d.mode == 6;
    }));

    linechart(d3.select("svg#cluavg"), 4, "Avg. Clu. Size", data.filter(function (d) {
        return d.mode == 5 || d.mode == 8;
    }));
});