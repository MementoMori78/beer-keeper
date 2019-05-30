$(function () {
    if ($('textarea#ta').length) {
        CKEDITOR.replace('ta');
    }
    $('a.confirmDeletion').on('click', function () {
        if (!confirm('Confirm deletion'))
            return false;
    });

    if ($("[data-fancybox]").length) {
        $("[data-fancybox]").fancybox();
    }
});


$(document).ready(function () {
    $('#search').keyup(function () {
        search_table($(this).val());
    });
    function search_table(value) {
        $('#products_table tr').each(function () {
            var found = 'false';
            $(this).each(function () {
                if ($(this).text().toLowerCase().indexOf(value.toLowerCase()) >= 0) {
                    found = 'true';
                }
            });
            if (found == 'true') {
                $(this).show();
            }
            else {
                $(this).hide();
            }
        });
    }
    $('#search').focus();
});

$('#exampleModal').on('show.bs.modal', function (event) {
    var button = $(event.relatedTarget) // Button that triggered the modal
    var recipient = button.data('whatever') // Extract info from data-* attributes
                                            // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
                                            // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
    var id = button.data('id');
    var modal = $(this)
    modal.find('.modal-title').text('Вкажіть кількість для ' + recipient);
    $('#_id').val(id);
})

$('#exampleModal').on('shown.bs.modal', function () {
    if($('#quantity').val()) {
        $('#quantity').val('');
    }
    $('#quantity').focus();
})  
