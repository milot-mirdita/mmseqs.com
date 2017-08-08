<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

$db = "mmseqs-regression.sqlite";
$db = new PDO("sqlite:$db");
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $smt = $db->prepare("SELECT created, name, git, mode, roc, rounds FROM reports WHERE created BETWEEN date('now', :timespan) AND DATETIME('now') ORDER BY created ASC");
    $smt->bindValue('timespan', '-6 months');
    $smt->execute();
    die(json_encode($smt->fetchAll(PDO::FETCH_ASSOC)));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST'
    || $_GET['secret'] != 'quarkohnesose'
    || !isset($_FILES['upfile']['error'])
    || is_array($_FILES['upfile']['error']
    || $_FILES['upfile']['error'] != UPLOAD_ERR_OK
    || $_FILES['upfile']['size'] > 1000000)
) {
    http_response_code(400);
    die('Invalid parameters!');
}
$data = file_get_contents($_FILES['upfile']['tmp_name']);
// $data = "SSE_SEARCH_pref	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	2	0.233054
// SSE_SEARCH	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	0	0.236084	1486450178.923900845	1486450182.483332132	1486450196.257726331	1486450196.873272646	
// AVX2_SEARCH_pref	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	2	0.233054
// AVX2_SEARCH	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	0	0.236084	1486450201.960068878	1486450205.244902667	1486450240.307768388	1486450241.126235968	
// SSE_PROFILE	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	1	0.40414	1486450246.105141883	1486450249.628444489	1486450318.323870105	1486450325.000222014	
// AXX2_PROFILE	c4436fbec572c7e9ce02ec36af238f8b7e7f700d	1	0.387362	1486450358.239873660	1486450362.716180893	1486450425.873245466	1486450430.297503969";


$reports = array();
foreach (explode("\n", trim($data)) as $row) {
    $fields = explode("\t", trim($row));
    if (count($fields) < 4) {
        http_response_code(400);
        die('Invalid request body!');
    }

    $name   = filter_var(current($fields),  FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_HIGH | FILTER_FLAG_STRIP_LOW);
    $git    = filter_var(next($fields),     FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_HIGH | FILTER_FLAG_STRIP_LOW);
    $mode   = filter_var(next($fields),     FILTER_SANITIZE_NUMBER_INT);
    $roc    = filter_var(next($fields),     FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
    $times  = filter_var(array_slice($fields, 4), FILTER_SANITIZE_NUMBER_FLOAT, FILTER_REQUIRE_ARRAY | FILTER_FLAG_ALLOW_FRACTION);

    $reports[] = array('name' => $name, 'git' => $git, 'mode' => $mode, 'roc' => $roc, 'times' => $times);
}

$db->exec("CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                name TEXT NOT NULL,
                git CHAR(20) NOT NULL,
                mode INTEGER NOT NULL,
                roc NUMBER NOT NULL,
                rounds TEXT, 
                created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )");  
$db->exec("CREATE INDEX IF NOT EXISTS reports_created_index ON reports (Created)");

$smt = $db->prepare("INSERT INTO reports (name, git, mode, roc, rounds) values (:name, :git, :mode, :roc, :times)");
foreach ($reports as $report) {
    $smt->bindValue('name', $report['name'], SQLITE3_TEXT);
    $smt->bindValue('git', $report['git'], SQLITE3_TEXT);
    $smt->bindValue('mode', $report['mode'], SQLITE3_INTEGER);
    $smt->bindValue('roc', $report['roc'], SQLITE3_FLOAT);
    $smt->bindValue('times', implode(",", $report['times']), SQLITE3_TEXT);
    $smt->execute();
}
