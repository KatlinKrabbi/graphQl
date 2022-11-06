async function queryAPI(query, variables) {
	return fetch("https://01.kood.tech/api/graphql-engine/v1/graphql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables })
	}).then(res => res.json())
		.then(data => {
			if ("errors" in data) throw data.errors
			return data.data
		})
}

const transactionsQ = `query ($username: String!, $offset: Int! = 0){
	user(where: {login: {_eq: $username}}) {
	  transactions(offset: $offset order_by: {amount: desc}) {
		type,
		path,
		amount,
		createdAt
	  }
	}
  }`

const transactionsQforAudits = `query ($username: String!, $offset: Int! = 0){
	user(where: {login: {_eq: $username}}) {
	  transactions(offset: $offset order_by: {createdAt: asc}) {
		type,
		path,
		amount,
		createdAt
	  }
	}
  }`

const doneProjectsQ = `query ($username: String!, $offset: Int! = 0) {
	user(where: {login: {_eq: $username}}) {
	  progresses(where: {isDone: {_eq: true}} offset: $offset) {
		path
	  }
	}
  }`

var doneProjectPaths = []

var totalXp = 0;
let offset = 0;
let username = "Katlink";

let auditDown = 0;
let auditUp = 0;
let auditRatio = 0;
let projects = [];

var xpData = [["Project", "XP earned"]];
var auditData = [["Project", "Audit ratio"]];

async function getValues() {
	offset = 0
	while (true) {
		var result = await queryAPI(transactionsQ, { username, offset })
		var xps = result.user[0].transactions
		//console.log(xps.length)
		if (xps.length == 0) {
			break;
		};
		offset += xps.length;

		for (let i = 0; i < xps.length; i++) {
			if (xps[i].type == "xp" && xps[i].path.search("/piscine-go/") == -1 &&
				xps[i].path.search("/rust/") == -1 && xps[i].path.search("/piscine-js/") == -1 && doneProjectPaths.includes(xps[i].path) &&
				!projects.includes(xps[i].path)) {

				projects.push(xps[i].path);
				totalXp += xps[i].amount;
				var project = xps[i].path.split("/")[3].replaceAll("-", " ")
				var r = [project, xps[i].amount]
				xpData.push(r);
			}

		};

	};

	//audits:
	offset = 0
	while (true) {
		var result = await queryAPI(transactionsQforAudits, { username, offset })
		var xps = result.user[0].transactions
		if (xps.length == 0) {
			break;
		};
		offset += xps.length;

		for (let i = 0; i < xps.length; i++) {
			if (xps[i].type == "up") {
				auditUp += xps[i].amount;
				auditRatio = auditUp / (auditDown / 100) / 100;
				if (auditData[auditData.length - 1][1] != Number(auditRatio.toFixed(1)) && auditRatio != 0) {
					auditData.push([new Date(xps[i].createdAt), Number(auditRatio.toFixed(1))])
				}

			} else if (xps[i].type == "down") {
				auditDown += xps[i].amount;
				auditRatio = auditUp / (auditDown / 100) / 100;
				if (auditData[auditData.length - 1][1] != Number(auditRatio.toFixed(1)) && auditRatio != 0) {
					auditData.push([new Date(xps[i].createdAt), Number(auditRatio.toFixed(1))])
				}
			};

		};

	};



}

document.querySelector(".searchButton").addEventListener("click", e => {
	doneProjectPaths = []

	totalXp = 0;
	offset = 0;

	auditDown = 0;
	auditUp = 0;
	auditRatio = 0;
	projects = [];

	xpData = [["Project", "XP earned"]];
	auditData = [["Project", "Audit ratio"]];
	username = document.querySelector("#search").value;
	profileData();

})

async function profileData() {
	await getProjects();
	await getValues();
	google.charts.load("current", { packages: ["corechart"] });
	google.charts.setOnLoadCallback(drawChartXp);

	google.setOnLoadCallback(drawChartAudit);

	/* drawChartXp(xpData);
	drawChartAudit(auditData); */

	document.querySelector("#avatar").style.backgroundImage = `url(https://01.kood.tech/git/user/avatar/${username}/0)`
	document.querySelector("#username").innerHTML = username;
	document.querySelector("#xp").innerHTML = Math.round(totalXp / 1000);
	let auditRatio = auditUp / (auditDown / 100) / 100;
	document.querySelector("#auditRatio").innerHTML = auditRatio.toFixed(1);
}

async function getProjects() {
	offset = 0
	while (true) {
		let result = await queryAPI(doneProjectsQ, { username, offset })
		let progresses = result.user[0].progresses
		if (progresses.length == 0) {
			break
		}
		offset += progresses.length
		for (let i = 0; i < progresses.length; i++) {
			doneProjectPaths.push(progresses[i].path)
		}
	}
}

/* google.charts.load("current", { packages: ["corechart"] });
google.charts.setOnLoadCallback(drawChartXp); */
function drawChartXp() {
	var data = google.visualization.arrayToDataTable(xpData);

	var view = new google.visualization.DataView(data);
	view.setColumns([0, 1]);

	var options = {
		title: 'XP by project',
		legend: 'none',
		backgroundColor: '#d8eff0',
		chartArea: { width: '50%', height: '90%' },
	};

	var chart = new google.visualization.BarChart(document.getElementById('xpGraph'));
	chart.draw(view, options);
}

//google.setOnLoadCallback(drawChartAudit);
function drawChartAudit() {
	var data = google.visualization.arrayToDataTable(auditData);

	var options = {
		title: 'Audit ratio over time',
		legend: 'none',
		backgroundColor: '#d8eff0',
		lineWidth: '4',
		pointShape: 'circle',
		pointSize: '8',
		vAxis: { title: 'Audit ratio', titleTextStyle: { color: '#888' } },
		chartArea: { width: '80%', height: '90%' },

	};

	var chart = new google.visualization.LineChart(document.getElementById('auditGraph'));
	chart.draw(data, options);
}
