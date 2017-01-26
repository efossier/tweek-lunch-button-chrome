const SENDER_ID = '953118966912';
// const REGISTER_GCM_URL = 'http://107.170.59.11:5000/gcm';
const SERVER_BASE = 'http://47332dd0.ngrok.io';

const PAGE_SIZES = {
    'register-page': [300, 180],
    'confirm-page': [300, 175],
    'menu-page': [300, 500],
    'error-menu-page': [300, 290]
};

window.onload = function() {
    console.log('Starting');

    if (!Notification || Notification.permission !== 'granted') { 
        console.log('Notifications not supported');
    }

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
        let user = $('#username-input').val();
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

    $('#unsub-button').click(function() {
        console.log('Unsubscribe');
        $('#unsub-button').text('Bye...');
        chrome.storage.local.get('user', function(result) {
            $.ajax(SERVER_BASE + '/gcm', {
                method: 'DELETE',
                data: {'User': result['user']},
                success: function(data, status) {
                    chrome.storage.local.set({user: null});
                    $('#unsub-button').text('Success');
                    transitionPage('menu-page', 'register-page');
                },
                error: function(xhr, textStatus, errStr) {
                    console.log('Error unsubscribing: %s, %s', textStatus, errStr);
                    $('#unsub-button').text('Failed :(');
                }
            });
        });
    });

    chrome.gcm.onMessage.addListener(function (message) {
        console.log('GOT A GCM MESSAGE');
        console.log(message);
        chrome.browserAction.getBadgeText({}, function(result) {
            let val = parseInt(result) || 0
            val = val + 1;
            chrome.browserAction.setBadgeText({text: '' + val})
            chrome.browserAction.setBadgeBackgroundColor({color: '#36a64f'})
        });
        var notification = new Notification('Lunch has arrived!', {
            icon: './icon.png',
            body: 'Catered by (restaurant name).'
        });
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
        $('#unsub-button').text('Unsubscribe');
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
        chrome.storage.local.get('user', function(result) {
            $('#username').text(result['user']);
        });
    }
    $('#' + pageName).show();
}

function updateMainPage(data) {
    console.log('Updating main page');
    console.log(data);
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
