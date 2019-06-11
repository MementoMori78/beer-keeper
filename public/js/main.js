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
            if (!value && window.location.href != "http://localhost:3000/balance" && window.location.href != "http://localhost:3000/days" ) { 
                $(this).hide(); 
            }
        });
    }
    const languageUkr = {
        "sProcessing":   "Зачекайте...",
        "sLengthMenu":   "Показати _MENU_ записів",
        "sZeroRecords":  "Записи відсутні.",
        "sInfo":         "Записи з _START_ по _END_ із _TOTAL_ записів",
        "sInfoEmpty":    "Записи з 0 по 0 із 0 записів",
        "sInfoFiltered": "(відфільтровано з _MAX_ записів)",
        "sInfoPostFix":  "",
        "sSearch":       "Пошук:",
        "sUrl":          "",
        "oPaginate": {
            "sFirst": "Перша",
            "sPrevious": "Попередня",
            "sNext": "Наступна",
            "sLast": "Остання"
        },
        "oAria": {
            "sSortAscending":  ": активувати для сортування стовпців за зростанням",
            "sSortDescending": ": активувати для сортування стовпців за спаданням"
        }
    }
    $('#search').focus();
    $('#balance-table').DataTable( {
        language: languageUkr,
        "order": [[ 1, "asc" ]]
    });
    $('#days-table').DataTable( {
        language: languageUkr,
        "order": [[ 0, "desc" ]]
    });
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
    if ($('#quantity').val()) {
        $('#quantity').val('');
    }
    $('#quantity').focus();
})

$('#customerMoney').change(function () {
    $('#check-out').attr('href', '/check-out?money=' + $(this).val());
    if (!$('#totalCostWithDiscount').attr('placeholder')) {
        $('#change').val(($(this).val() - parseFloat($('#totalCost').attr('placeholder'))).toFixed(2));
    } else { 
        $('#change').val(($(this).val() - parseFloat($('#totalCostWithDiscount').attr('placeholder'))).toFixed(2));
    }
})

$('#discount-input').change(function () {
    let input = parseInt($(this).val());
    console.log(input);
    if (input > 0 && input <= 100) {
        $('#update-discount-btn').attr('href', '/add-discount?discount=' + $(this).val());
    }
})