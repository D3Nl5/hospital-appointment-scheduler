// Function to log out the user
function logout() {
  // $.get('/logout', () => {
    // Clear the token cookie
    // document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; // Clear the token cookie
    document.cookie = `token=; secure; samesite=strict`;
    // Redirect to a different page or the same page after logging out
    window.location.href = 'index.html'; // You can change the URL as needed
  // });
}

// Check if the user is logged in
$(document).ready(() => {
  const token = getTokenFromCookie();
  // console.log(token);

  if (token) {

    // User is logged in (token is present)
    $.get('/getFirstName', {
      token: token
    }, (data) => {
      // User is logged in and you have their first name
      // $('#home-nav').removeClass('d-none');
      // $('#login-nav').addClass('d-none');
      // $('#register-nav').addClass('d-none');
      $('#appointments-nav').removeClass('d-none');
      $('#profile-nav').removeClass('d-none');
      $('#history-nav').removeClass('d-none');
      $('#logout-nav').removeClass('d-none');
      $('#welcome-text').removeClass('d-none');
      $('#username').text(data.firstName); // Assuming you are sending the first name in the response
      if(data.role=='admin'){
        $('#admin-history-nav').removeClass('d-none');
        $('#admin-users-nav').removeClass('d-none');
      }
      if(data.role=='nurse'){
        $('#admin-history-nav').removeClass('d-none');
      }
      // Show the profile and logout links in the navbar
      // $('#profile-nav').css('display', 'block');
      // $('#reservationhistory-nav').css('display', 'block');
      // $('#logout-nav').css('display', 'block');
    });
  } else {
    // User is not logged in (token is not present)
    // $('#login-nav').removeClass('d-none');
    // $('#register-nav').removeClass('d-none');
    $('#appointments-nav').addClass('d-none');
    $('#profile-nav').addClass('d-none');
    $('#history-nav').addClass('d-none');
    $('#admin-history-nav').addClass('d-none');
    $('#logout-nav').addClass('d-none');
    $('#welcome-text').addClass('d-none');
  }
});

// Function to get the token from a cookie
function getTokenFromCookie() {
  const cookies = document.cookie.split(';').map(cookie => cookie.trim());
  const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
  // console.log('Token Cookie:', tokenCookie); // Add this line for debugging
  if (tokenCookie) {
    return tokenCookie.split('=')[1];
  }
  return null;
}
