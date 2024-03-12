<?php
include_once('../config.php');

$DBServer = DB_SERV; // e.g 'localhost' or '192.168.1.100'
$DBUser   = DB_USER;
$DBPass   = DB_PASS;
$DBName   = DB_NAME;

$conn = new mysqli($DBServer, $DBUser, $DBPass, $DBName);

// check connection
if ($conn->connect_error) {
  trigger_error('Database connection failed: '  . $conn->connect_error, E_USER_ERROR);
}

$newsql = "CREATE TABLE IF NOT EXISTS `quickbill` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inv_number` varchar(30) NOT NULL,
  `inv_date` date NOT NULL,
  `inv_amount` decimal(8,2) NOT NULL,
  `registration` varchar(10) NOT NULL,
  `inv_data` text NOT NULL COMMENT 'json-encoded',
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='for mobile app';
";

$result = mysqli_query($conn, $newsql);

/**/
function str2html( $string ) {
	$str = str_split( $string );
	$html = "";
	foreach( $str as $char ) {
		$html .= ord( $char ) > 63 ? "&#" . ord( $char ) . ";" : $char;
	}

	return $html;
}

function addInvoice2DB( $request ) {
	global $conn;

	$sql = "INSERT INTO quickbill VALUES (NULL,'" . 
	$request['inv_number'] . "', '" . 
	$request['date'] . "', " . 
	$request['inv_total'] . ", '" . 
	$request['registration'] . "', '" . 
	mysqli_real_escape_string( $conn, json_encode($request) ) . "',
	NULL)";
	
	$rs = $conn->query( $sql ) or die ("Insert error: " . mysqli_error( $conn ));

	return $conn->insert_id;
}

function updateAuth( $id, $request ) {
	global $conn;

	$serialized_request = serialize($request);

	$sql = "UPDATE authorization SET auth_data = '" . mysqli_real_escape_string( $conn, json_encode($request) ) . ", formdata = '" . mysqli_real_escape_string( $conn, $serialized_request ) . "' WHERE id = $id";

	if ( $conn->query( $sql ) === false ) {
		trigger_error( 'Wrong SQL: ' . $sql . ' Error: ' . $conn->error, E_USER_ERROR );
	} else {
		$affected_rows = $conn->affected_rows;
	}

	return $affected_rows;
}

function getAllAuth() {
	global $conn;

	$sql = "SELECT * FROM authorization";
	$rs = $conn->query( $sql );

	return $rs;
}

function getAuth( $id ) {
	global $conn;

	$sql = "SELECT * FROM authorization WHERE id = $id";
	$rs = $conn->query( $sql );

	return $rs;
}

function getAuthFor( $registration ) {
	global $conn;

	$sql = "SELECT * FROM authorization WHERE registration = '" . strtoupper( $registration ) . "'";
	$rs = $conn->query( $sql );

	return $rs;
}

function deleteAuth( $id ) {
	global $conn;

	$sql = "DELETE FROM authorization WHERE id = $id";
	$rs = $conn->query( $sql );

	return $conn->affected_rows;
}

function getRecordFromFilename( $filename ) {
	// assume filename = https://www.bocamx.com/authorizations/filename_23.pdf. We want the number at the end (23).
	$parts = explode( "_", $filename );
	$parts = explode( ".", $parts[1] );
	return $parts[0];
}

function getRegisteredAircraft( $reg ) {

	global $conn;

	$rq = "SELECT * FROM authorization WHERE registration = '$reg' ORDER BY auth_date DESC LIMIT 1";
	$rs = $conn->query( $rq ) or die ("Insert error: " . mysqli_error( $conn ));

	if ( $rs ) {
		$aircraft = $rs->fetch_assoc();
	}

	return $aircraft;

}
/**/
function addPayment( $payment ) {
	global $conn;

	$tailnumber = strlen( $payment['tail'] ) > 0 ? mysqli_real_escape_string( $conn, $payment['tail'] ) : "";

	$sql = "INSERT INTO payments VALUES ('" . $payment['transaction_id'] . "', '" . $tailnumber . "', " . $payment['amount'] . ", '" . $payment['invoice'] . "', '" . addslashes( json_encode($payment['payee']) ) . "', NULL)";
	$rs = $conn->query( $sql ) or die ("Insert error: " . mysqli_error( $conn ));

	return;
}

function getPayments( $startat = 0, $lines ) {
	global $conn;


}

function getPaymentsOfDay( $day = "" ) {
	if ( empty( $day ) ) $day = date('Y-m-d', strtotime( '-1 day' ) );
	$day = $day . "%";

	global $conn;

	$sql = "SELECT * FROM payments WHERE tr_date LIKE '$day'";
	$rs = $conn->query( $sql );

	return $rs;
}

function createPNGFromBase64($base64_content, $output_file) {
    // Remove data:image/png;base64 from base64 string
    $base64_content = str_replace('data:image/png;base64,', '', $base64_content);

    // Decode base64 string
    $image_data = base64_decode($base64_content);

    // Check if the image data is valid
    if ($image_data === false) {
        return false; // Return false if the base64 content is invalid
    }

    // Create image resource from image data
    $image = imagecreatefromstring($image_data);

    if ($image === false) {
        return false; // Return false if imagecreatefromstring fails
    }

	// remove black background created from transparency
	$background = imagecolorallocate($image , 0, 0, 0);
	imagecolortransparent($image, $background);
	imagealphablending($image, false);
	imagesavealpha($image, true);

    // Save the image to the file
    $result = imagepng($image, $output_file);

    // Free up memory
    imagedestroy($image);

    return $result; // Return the result of saving the image
}

// ===========================  USERS DATABASE TABLE =========================== //
//                                                                               //
//                         Logins to use AOG Billing App                         //
//                                                                               //
// ============================================================================= //

$usersql = "CREATE TABLE IF NOT EXISTS `users` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`full_name` varchar(30) NOT NULL,
	`email` varchar(30) NOT NULL,
	`pw_hash` varchar(255) NOT NULL,
	`user_role` ENUM('USER','BOSS'),
	`active` TINYINT(1),
	`modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COMMENT='for mobile app';
  ";
  
  $result = mysqli_query($conn, $usersql);


// Function to create a new login record
function createLogin($full_name, $email, $encrypted_password, $user_role, $active, $changed) {
    global $conn;
    $sql = "INSERT INTO logins (full_name, email, pw_hash, user_role, active, changed) VALUES (?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssssss", $full_name, $email, $encrypted_password, $role, $active, $changed);
    if ($stmt->execute()) {
        return true;
    } else {
        return false;
    }
}

// Function to read login records
function readLogins() {
    global $conn;
    $sql = "SELECT * FROM logins";
    $result = $conn->query($sql);
    $logins = array();
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $logins[] = $row;
        }
    }
    return $logins;
}

// Function to update a login record
function updateLogin($id, $full_name, $email, $encrypted_password, $user_role, $active, $date) {
    global $conn;
    $sql = "UPDATE logins SET full_name=?, email=?, pw_hash=?, user_role=?, active=?, changed=? WHERE id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssssssi", $full_name, $email, $encrypted_password, $role, $active, $changed, $id);
    if ($stmt->execute()) {
        return true;
    } else {
        return false;
    }
}

// Function to delete a login record
function deleteLogin($id) {
    global $conn;
    $sql = "DELETE FROM logins WHERE id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        return true;
    } else {
        return false;
    }
}


?>
