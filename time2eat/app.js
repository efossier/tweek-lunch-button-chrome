const SENDER_ID = '953118966912';
const SERVER_BASE = 'http://107.170.59.11:5000';

const PAGE_SIZES = {
    'register-page': [300, 220],
    'confirm-page': [300, 195],
    'menu-page': [300, 500],
    'error-menu-page': [300, 290],
    'settings-page': [300, 250]
};

let curPage = null;

window.onload = function() {
    console.log('Starting');

    if (!Notification || Notification.permission !== 'granted') { 
        console.log('Notifications not supported');
    }

    chrome.browserAction.setBadgeText({text: ''})
    chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 0, 0]})

    chrome.storage.local.get('gcmToken', function(result) {
        console.log('Registering with google');
        if (result['gcmToken']) {
            console.log('Already registered with google.');
            return;
        }

        chrome.gcm.register([SENDER_ID], function(registrationId) {
            if (chrome.runtime.lastError) return;
            console.log('Got reg id %s', registrationId);
            chrome.storage.local.set({gcmToken: registrationId});
        });
    });

    chrome.storage.local.get('user', function(result) {
        if (!result['user']) {
            showPage('register-page');
        } else {
            showPage('menu-page');
        }
    });

    $('#register-button').click(function() {
        console.log('Register pressed');
        updateRegisterButton('Registering...', true);
        let user = $('#username-input').val().toLowerCase().trim();
        console.log('User %s', user);
        if (!user || !user.length) {
            updateRegisterButton('Register', false);
            return;
        }

        chrome.storage.local.get('gcmToken', function(result) {
            let registrationId = result['gcmToken'];
            if (!registrationId) return;

            console.log('Registering with time2eat server');
            $.ajax(SERVER_BASE + '/gcm', {
                method: 'POST',
                data: {'User': user, 'Token': registrationId},
                success: function(data, status) { 
                    chrome.storage.local.set({user: user});
                    updateRegisterButton('Success', true);
                    transitionPage('register-page', 'confirm-page');
                },
                error: function(xhr, textStatus, errStr) {
                    console.log('Error registering: %s, %s', textStatus, errStr);
                    updateRegisterButton('Failed :(', false);
                }
            });
        });
    });

    $('#next-button').click(function() {
        console.log('Next pressed');
        transitionPage('confirm-page', 'menu-page');
    });

    $('#signout').click(function() {
        console.log('Unsubscribe');
        $('#signout .action-text').text('Bye...');
        chrome.storage.local.get('user', function(result) {
            $.ajax(SERVER_BASE + '/gcm', {
                method: 'DELETE',
                data: {'User': result['user']},
                success: function(data, status) {
                    chrome.storage.local.set({user: null});
                    $('#signout .action-text').text('Success');
                    transitionPage('menu-page', 'register-page');
                },
                error: function(xhr, textStatus, errStr) {
                    console.log('Error unsubscribing: %s, %s', textStatus, errStr);
                    $('#signout .action-text').text('Failed :(');
                }
            });
        });
    });

    $('#settings').click(function() {
        console.log('Settings pressed');
        transitionPage('menu-page', 'settings-page');
    });

    $('#back-button').click(function() {
        console.log('Back to menu');
        transitionPage('settings-page', 'menu-page');
    });

    $('#update-settings-button').click(function() {
        console.log('Updating settings');
        $("#settings-error-msg").hide();
        $('#update-settings-button').text('Updating...');
        let channels = [];
        $('input.channel-checkbox').each(function(i, elem) {
            elem = $(elem);
            if (elem.is(':checked')) {
                channels.push(elem.val());
            }
        });

        console.log(channels);
        let phoneNumber = $('#pn-input').val().trim() || ''; 
        console.log(phoneNumber);
        if (channels.includes('sms') && (!phoneNumber.length || !phoneNumber.startsWith('+'))) {
            console.log('invalid phone number');
            $('#num-error-msg').show();
            $('#num-error-msg').text('Invalid');
        }

        chrome.storage.local.get('user', function(res) {
            if (!res['user']) {
                $('#update-settings-button').text('Failed :(');
                return;
            }
            let body = res['user'] + ': ' + channels.join(',');
            console.log(body);

            $.ajax(SERVER_BASE + '/users', {
                method: 'POST',
                data: {From: phoneNumber, Body: body},
                success: function(data, status) {
                    transitionPage('settings-page', 'menu-page');
                },
                error: function(xhr, textStatus, errStr) {
                    console.log('Error updating preferences: %s, %s', textStatus, errStr);
                    $('#update-settings-button').text('Failed :(');
                }
            });
        });
    });

    $("#username-input").keyup(function(event){
        if(event.keyCode == 13) {
            $("#register-button").click();
        }
    });

    $(window).keyup(function(event) {
        if(event.keyCode == 13 && curPage === 'confirm-page') {
            $("#next-button").click();
        }
    });

    console.log('Initialized!');
};

function updateRegisterButton(msg, disabled) {
    console.log('Updating button');
    $('#register-button').text(msg);
    $('#register-button').prop('disabled', disabled);
}

function transitionPage(from, to) {
    console.log('Transitioning %s -> %s', from, to);
    $('#' + from).hide(0, null, function() {
        showPage(to);
    });
}

function showPage(pageName) {
    console.log('Showing page %s', pageName);
    setWindowSize(PAGE_SIZES[pageName]);
    if (pageName === 'menu-page') {
        $('#signout .action-text').text('Sign Out');
        $.ajax(SERVER_BASE + '/menu', {
            method: 'GET',
            success: function(data, status) { 
                updateMainPage(data);
            },
            error: function(xhr, textStatus, errStr) {
                console.log('Error loading menu: %s, %s', textStatus, errStr);
                errorMainPage();
            }
        });
        setUsername();
    }
    else if (pageName === 'settings-page') {
        setUsername();
        $('update-settings-button').text('Save');
        chrome.storage.local.get('user', function(result) {
            if (result['user']) {
                $.ajax(SERVER_BASE + '/users/' + result['user'], {
                    method: 'GET',
                    success: function(data, status) { 
                        $('input.channel-checkbox').each(function(i, elem) {
                            elem = $(elem);
                            if (data['notifications'][elem.val()]) {
                                elem.prop('checked', true);
                            } else {
                                elem.prop('checked', false);
                            }
                        });
                        $("#pn-input").val(data['phoneNumber'] || 'Unknown Number');
                    },
                    error: function(xhr, textStatus, errStr) {
                        console.log('Error loading user info: %s, %s', textStatus, errStr);
                    }
                });
            }
        });
    }
    $('#' + pageName).show();
    curPage = pageName;
}

function updateMainPage(data) {
    console.log('Updating main page');
    chrome.storage.local.set({menu: data});
    $('#error').hide();
    $('#menu').show();
    $('#vendor-image').prop('src', data.vendorImage);
    $('#vendor-name').text(data.vendor);
    $('#menu-items').empty();
    $.each(data.menuItems, function(i) {
        let item = data.menuItems[i];
        let entry = $('.menu-item.template').clone();
        $('#menu-items').append(entry);
        entry.removeClass('template');
        entry.find('.menu-item-name').text(item.item);
        entry.find('.menu-item-descr').text(item.description);
        entry.show();
        if (i < (data.menuItems.length -1)) {
            $('#menu-items').append('<div class="menu-separator"></div>');
        }
    })
}

function errorMainPage() {
    console.log('Showing error main page');
    $('#error').show();
    $('#menu').hide();
    setWindowSize(PAGE_SIZES['error-menu-page']);
}

function setWindowSize(input) {
    let width = input[0];
    let height = input[1];
    $('html').width(width + 20);
    $('html').height(height + 20);
    $('body').width(width);
    $('body').height(height);
}

function setUsername() {
    chrome.storage.local.get('user', function(result) {
        if (result['user']) {
            $('.username').text(result['user']);
        } else {
            $('.username').text('{username}');
        }
    });
}
