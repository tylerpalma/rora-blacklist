$('[data-show-sectors]').on('click', function () {
  var nextRow = $(this).parent().parent().next();

  if (nextRow.hasClass('open')) {
    $(this).find('i').removeClass('fa-angle-up').addClass('fa-angle-down');
    $(this).removeClass('open');
    nextRow.removeClass('open').hide();
  } else {
    $(this).find('i').removeClass('fa-angle-down').addClass('fa-angle-up');
    $(this).addClass('open');
    nextRow.addClass('open').show();
  }
});