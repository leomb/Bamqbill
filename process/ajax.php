<?php
require_once("functions.php");

error_reporting(0);

if ( is_string( $_REQUEST['operation'] ) ) {
	$function = $_REQUEST['operation'];
} else {
	exit();
}

echo $function();
exit();

function getAircraftData() {
	$registration = $_REQUEST['registration'];

	global $conn;

	$rq = "SELECT * FROM authorization WHERE registration = '$registration' ORDER BY auth_date DESC LIMIT 1";
	$rs = $conn->query( $rq ) or die ("Select error: " . mysqli_error( $conn ));

	if ( $rs ) {
		$row = $rs->fetch_assoc();
		$aircraft = json_decode( $row['auth_data']);
	}

	return json_encode( $aircraft );
}

function getAuthorizations() {
  global $conn;
  $qty = 12;

	$sql = "SELECT id, auth_data FROM authorization ORDER BY id DESC LIMIT $qty";
	$rs = $conn->query( $sql );

  $authList = [];

	if ( $rs ) {
		while ($row = $rs->fetch_assoc()) {
		  $temp = json_decode( $row['auth_data'] );
		  $temp->id = $row['id'];
		  $authList[] = $temp;
		}
	}

	return json_encode( $authList );
}

function registerBillAndSend() {
	$bill_id = addInvoice2DB( $_REQUEST );

	// Create associative array of description text snippets for each service / product.
	// Each array item has an array with 0: Description, 1: Quantity, 2: Dollar ammount.
	$description = [];

	$description['outOfCountry'] = ["Out of country"," ",$_REQUEST['outOfCountry']]; // <-No dollar amount
	$description['aog'] = ["AOG Callout"," ",$_REQUEST['amount-aog']];
	$description['labor-hrs'] = ["Hours of labor",$_REQUEST['labor-hrs'],$_REQUEST['amount-labor']];
	$description['o2-service'] = ["Oxygen service"," ",$_REQUEST['o2amount']];
	$description['oil-engine1'] = ["Oil check Engine 1, + Qts. of Oil",$_REQUEST['oil-qt1'],$_REQUEST['amount-eng-oil1']];
	$description['oil-engine2'] = ["Oil check Engine 2, + Qts. of Oil",$_REQUEST['oil-qt2'],$_REQUEST['amount-eng-oil2']];
	$description['oil-engine3'] = ["Oil check Engine 3, + Qts. of Oil",$_REQUEST['oil-qt3'],$_REQUEST['amount-eng-oil3']];
	$description['oil-apu'] = ["Oil check APU, + Qts. of Oil",$_REQUEST['oil-apu-qt'],$_REQUEST['amount-oil-apu']];
	$description['fuel'] = [$_REQUEST['fuel'], $_REQUEST['fuel-qty'], $_REQUEST['amount-fuel']];
	$description['other-service'] = [$_REQUEST['other-service']," ",$_REQUEST['additional-amount']];

	// bundle descriptions for extra non-service fees
	$x_fees = implode(" + ", $_REQUEST['extrafees'] );
	$description['extrafees'] = [$x_fees, " ", $_REQUEST['amount-extra']];
	$body_fees = implode(" + ", $_REQUEST['body']);
	$description['body'] = [$body_fees, " ", $_REQUEST['amount-body']];
	$text_message = "";
	$html_message = "";

	foreach( $_POST as $name => $value ) {
		if ( is_array( $value )) $value = implode(", ", $value);
		$$name = $value;

		if ( false === strpos("f_type|operation|request_type|x|_ga|_gid|PHPSESSID", $name) ) {
			if ( strlen($value) > 0 && $description[$name] !== NULL ) {
      			$text_message .= str_pad($description[$name][0],65," ") . $description[$name][1] . "    $" . str_pad($description[$name][2],8," ",STR_PAD_LEFT) . "\n";
      			$html_message .= "\t\t\t<tr style=\"background: white; margin-bottom: 1px;\">\n\t<td width=\"75%\">" . $description[$name][0] . "</td>\n\t<td width=\"5%\">" . $description[$name][1] . "</td>\n\t<td width=\"20%\" style=\"text-align:right\">" . $description[$name][2] . "</td></tr>\n";
			}
		}
	}
	
	$file_root = FILE_ROOT;

	if ( !empty( $_REQUEST['signatureFile'] ) ) { // print signatute on invoice
		$pngsrc = $_REQUEST['signatureFile'];
		$invoice = $_REQUEST['inv_number'] . "-" . $bill_id . ".png";
		saveSig($pngsrc, $invoice); // create the signature png file
		$caption = "AUTHORIZED BY " . $_REQUEST['customer_name'];
	} else {
		$invoice = "pixel.png";
		$caption = "";
	}

	$time = date('H:i:s');
	$sent = 0;
	$fmt = numfmt_create( 'en_US', NumberFormatter::CURRENCY );
	$total_amount = numfmt_format_currency( $fmt, $_REQUEST['inv_total'], "USD");
	$notes = $_REQUEST['notes'] > "" ? "<p style=\"color: red; padding: 20px;\">" . $_REQUEST['notes'] . "</p>" :"";
    //return '{"result":"' . $$name . '"}';

	if ( $_REQUEST['f_type'] == "request" ) {

// create and send email

$plaintext = "
INVOICE " . $_REQUEST['inv_number'] . ":\n\n
For maintenance work performed on your aircraft #" . $_REQUEST['registration'] . "\n\n" .
$_REQUEST['customer'] . "\n\n
DESCRIPTION                                                             QTY AMNT
-------------------------------------------------------------------------------\n" .
$text_message .
"------------------------------------------------------------------------------\n" .
str_pad("TOTAL",65) . "   " . $total_amount . "\n\n" .
$_REQUEST['notes'] . "\n\n" .
"Please proceed to pay online securely by using the URL link below.\n\n
https://bocamx.com/pages/payonline.php \n\n";

$customer = nl2br($_REQUEST['customer']);

$msg = <<<MSG
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en-US" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<!--[if !mso]><!-->
	<meta http-equiv="X-UA-Compatible" content="IE=edge" />
	<meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
	<!--<![endif]-->
    <title>AOG Invoice</title>
	<!--[if (gte mso 9)|(IE)]>
	<style type="text/css">
		table {border-collapse: collapse;}
	</style>
	<![endif]-->
    <style>
        body { background: #efefef; color: #707070; font-family:'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;}
        table { background-color: white; width: 580px; margin: 10px auto; border: 0; }
        td { padding: 5px 20px; }
        .btn { background: #283779; font-weight: bold; width: 200px; margin: 10px auto; text-align: center; }
		.btn a { color: white; text-decoration: none; display: inline-block; padding: 15px; }
		.right { text-align: right; }
		.sig { max-width: 280px; max-height: 50px; text-align: center; display: relative; }
		.siglabel { font-size: 9px; }
    </style>
</head>
<body>
    <table style="max-width: 600px; margin: auto; background-color: white; padding-top:20px">
		<tr>
			<td>
        <table>
            <tr>
                <td><img src="https://bocamx.com/bamqbill/img/BAM-small.svg" alt="BAM logo" style="max-width: 150px" /></td>
                <td class="right">
                    <b>INVOICE</b><br>
                    {$_REQUEST['inv_number']}-$bill_id
                </td>
            </tr>
            <tr>
                <td>$customer</td>
                <td class="right">{$_REQUEST['date']}</td>
            </tr>
        </table>
		<table>
			<tr>
				<td height="15" width="600">&nbsp;</td>
			<tr>
		</table>
		<table>
			<tr>
				<td height="15" width="580" margin="20" style="font-style: italic">For maintenance work performed on your aircraft #{$_REQUEST['registration']}.</td>
			</tr>
		</table>
		<table style="background-color: #283779; color: white; font-size: 12px; padding: 5px 0px; margin-bottom: 15px">
			<tr>
				<td width="75%">DESCRIPTION</td>
				<td width="5%">QTY</td>
				<td width="20%">AMOUNT $</td>
			</tr>
		</table>
        <table style="background:#dedede;">
$html_message
        </table>
        <table>
            <tr style="border-bottom: 1px solid gray; font-weight: bold;">
            	<td width="55%"><span class="siglabel">AUTHORIZED: {$_REQUEST['customer_name']}</span><br><img class="sig" src="{$file_root}sigs/{$invoice}" /></td>
               	<td width="25%" class="right" style="vertical-align: top;">TOTAL</td>
                <td width="20%" style="text-align:right; vertical-align: top">$total_amount</td>
            </tr>
        </table>
        <table style="margin-bottom: 30px;">
			<tr>
            	<td>$notes</td>
			</tr>
			<tr>
            	<td style="text-align: center;">Please proceed to pay online securely by pressing the button below.</td>
			</tr>
			<tr>
				<td>
					<table style="margin:0 auto; width: 200px;">
						<tr>
							<td class="btn"><a href="https://bocamx.com/pages/payonline.php">PAY ONLINE</a></td>
						</tr>
					</table>
				</td>
			</tr>
        </table>
			</td>
		</tr>
    </table>

</body>
</html>
MSG;


$subject = "Invoice for: " . $_REQUEST['registration'];

$OB = "----=_BAM" . uniqid();
$IB = "----=_BAM" . uniqid();

// headers need to be in the correct order...
$headers = "From: B.A.M. <" . E_FROM . ">\r\n"; ## See NOTE at the bottom of this file.
$headers .= "Reply-To: <" . $_REQUEST['customer_email'] . ">\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"" . $OB . "\"\r\n";
//
$headers .= "X-Sender: B.A.M. <" . E_FROM . ">\r\n";
$headers .= "X-Mailer: BAM-MAIL\r\n"; //mailer
$headers .= "X-Priority: 3\r\n"; //1 UrgentMessage, 3 Normal
$headers .= "Return-Path: <" . E_FROM . ">\r\n";
$headers .= "Cc: " . E_CC . "\r\n";
$headers .= "Bcc: " . E_BCC . "\r\n";//

$message  = "--" . $OB . "\r\n";
$message .= "Content-Type: multipart/alternative; boundary=\"" . $IB . "\"\r\n";

$message .= "\r\n--" . $IB . "\r\n";
$message .= "Content-Type: text/plain; charset=UTF-8\r\n";
$message .= "Content-Transfer-Encoding:  7bit\r\n\r\n";

## plain text begin
$message .= $plaintext;

$message .= "\r\n--" . $IB . "\r\n";
$message .= "Content-Type: text/html; charset=UTF-8; format=flowed\r\n";
$message .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";

## html section begins
$message .= $msg;

$message .= "\r\n--" . $IB . "--\r\n";

/**/

if ( ( isset( $_FILES['attachment'] ) ) && ( $_FILES['attachment']['size'] > 0) ) {
	// get the content-type of the file
	$filename = basename($_FILES['attachment']['name']);
	$filename_parts = explode(".", $filename );
	$filetype = guessFileType( end( $filename_parts) );

	$message .= "\r\n--".$IB."\r\n";
	$message .= "Content-Type: " . $filetype . "; name=\"".$filename."\"\r\n";
	$message .= "Content-Transfer-Encoding: base64\r\n";
	$message .= "Content-Disposition: attachment; filename=\"".$filename."\"\r\n\r\n";

	// attachment goes here
	$order = $_FILES['attachment']['tmp_name'];
	$fd = fopen($order,"r");
	$filecontent = fread($fd,filesize($order));
	fclose($fd);
	$filecontent = chunk_split(base64_encode($filecontent));
	$message .= $filecontent;
}

$message .= "\r\n--" . $OB . "--\r\n\r\n";

$sent = mail( E_TO, $subject, $message, $headers );

$folder = SITE_PATH . "submissions/";
$filename = $folder  . $_REQUEST['inv_number'] . "-" . $bill_id . ".html";
file_put_contents( $filename, $msg );

if ( $sent ) {
    return '{"result":"Email sent."}';
} else {
    return error_get_last()['message'];
}

	}
}

function guessFileType( $extension ) {
	$extension = strtoupper($extension);
	switch ( $extension ) {
		case "JPG"	: return "image/jpeg"; break;
		case "JPEG"	: return "image/jpeg"; break;
		case "PNG"	: return "image/png"; break;
		case "PDF"	: return "application/pdf"; break;
		case "DOC"	: return "application/msword"; break;
		case "DOCX"	: return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; break;
		default 	: return "application/xdownload";
	}
}

function checkEmailSent($sent) {
    if ( false === $sent ) {
        throw new Exception("Email could not be sent.");
    }
    return true;
}

function exceptions_error_handler($severity, $message, $filename, $lineno) {
    throw new ErrorException($message, 0, $severity, $filename, $lineno);
}

set_error_handler('exceptions_error_handler');

function createRatesFile() {
	// Process form data
	$varRates = array(
		"usa" => array(
			"wkdy" => array(
				"hrs" => $_REQUEST['usa-wkdy-hrs'],
				"aog" => $_REQUEST['usa-wkdy-aog'],
				"o2"  => $_REQUEST['usa-wkdy-o2'],
				"oil" => $_REQUEST['usa-wkdy-oil']
			),
			"over" => array(
				"hrs" => $_REQUEST['usa-over-hrs'],
				"aog" => $_REQUEST['usa-over-aog'],
				"o2"  => $_REQUEST['usa-over-o2'],
				"oil" => $_REQUEST['usa-over-oil']
			),
			"holi" => array(
				"hrs" => $_REQUEST['usa-holi-hrs'],
				"aog" => $_REQUEST['usa-holi-aog'],
				"o2"  => $_REQUEST['usa-holi-o2'],
				"oil" => $_REQUEST['usa-holi-oil']
			)
		),
		"foreign" => array(
			"wkdy" => array(
				"hrs" => $_REQUEST['foreign-wkdy-hrs'],
				"aog" => $_REQUEST['foreign-wkdy-aog'],
				"o2"  => $_REQUEST['foreign-wkdy-o2'],
				"oil" => $_REQUEST['foreign-wkdy-oil']
			),
			"over" => array(
				"hrs" => $_REQUEST['foreign-over-hrs'],
				"aog" => $_REQUEST['foreign-over-aog'],
				"o2"  => $_REQUEST['foreign-over-o2'],
				"oil" => $_REQUEST['foreign-over-oil']
			),
			"holi" => array(
				"hrs" => $_REQUEST['foreign-holi-hrs'],
				"aog" => $_REQUEST['foreign-holi-aog'],
				"o2"  => $_REQUEST['foreign-holi-o2'],
				"oil" => $_REQUEST['foreign-holi-oil']
			)
		)
	);

	$flatRates = array("qt" => $_REQUEST['qt'],
		"rts" => array(
			$_REQUEST['rtsfree'],
			$_REQUEST['signoff'],
			$_REQUEST['logbook']),
		"woship"	=> $_REQUEST['woship'],
		"access"	=> $_REQUEST['access'],
		"tks"		=> $_REQUEST['tks'],
		"tire"		=> $_REQUEST['tire'],
		"n2"		=> $_REQUEST['n2'],
		"lav"		=> $_REQUEST['lav'],
		"fuel" => array(
			$_REQUEST['jeta'],
			$_REQUEST['jetaplus'])
	);

	// Prepare response data
	$response = array(
		$varRates, $flatRates
	);

    // Encode the data to JSON format
	$json_data = json_encode($response, JSON_PRETTY_PRINT);

	// Write a file with the json object
	$file = '../bamrates.json';
	file_put_contents($file, $json_data);

	// Send JSON response
	header('Content-Type: application/json');
	echo json_encode($response);
}

function saveSig($sig, $invoice) {
	$site_path = SITE_PATH . "sigs/";
	if (!file_exists($site_path)) {
		mkdir($site_path, 0777, true);
	}
	$filename_parts = $site_path . "/" . $invoice;
	// create PNG file with sig data
	$result = createPNGFromBase64($sig, $filename_parts);

	if ($result !== false) {
		echo 'PNG image created successfully.';
	} else {
		echo 'Failed to create PNG image.';
	}
}
