import { LightningElement, api, wire, track } from 'lwc';
import { createRecord, deleteRecord, updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLineItems from '@salesforce/apex/CaseExpensesController.getLineItems';
import { refreshApex } from '@salesforce/apex';
import getItemOptionsForExpense from '@salesforce/apex/CaseExpensesController.getItemOptionsForExpense';
import fetchWorkOrderIDs from '@salesforce/apex/CaseExpensesController.fetchWorkOrderIDs';

export default class CaseExpenses extends LightningElement {
    @api recordId;
    @track workOrderId; // Combobox
    @track itemList;
    @track isLoaded = false;
    @track error;
    @track newExpenses;
    pendingExpenses;        //  To track changes in the Tracked newExpenses
        
    @wire(getLineItems, { caseID: '$recordId' }) expenses;
    updatedExpenses;        // To track changes in the "read-only" expenses param

    get acceptedFormats() {
        return ['.pdf', '.png', '.jpg', '.docx', '.doc', '.xlsx', '.xlsm', '.csv'];
    }

    handleUploadFinished(event) {
        // Get the list of uploaded files
        const uploadedFiles = event.detail.files;
        alert("No. of files uploaded : " + uploadedFiles.length);
    }

    saveRecords() {
        var fields;
        var updatedExpense;
        var i;
        var newExpense;

        //  First update the existing ones
        for (i = 0 ; i < this.updatedExpenses.length; i++){
            fields = this.updatedExpenses[i];
            updatedExpense = { fields };
            if (fields.ItemCost__c === '--NONE--')
                fields.ItemCost__c = null;
            updateRecord(updatedExpense)
            .then(() =>{
                refreshApex(this.expenses);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Expenses Updated',
                        variant: 'success',
                    }),
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error Updating Records',
                        message: error.body.message,
                        variant: 'error',
                    }),
                );
            });
        }

        //  Then insert new ones
        for (i = 0 ; i < this.pendingExpenses.length; i++){
            fields = this.pendingExpenses[i];
            delete fields.row;
            if (fields.ItemCost__c === '--NONE--')
                fields.ItemCost__c = null;
            newExpense = { fields, "ApiName":"WorkOrderLineItem" };
            createRecord(newExpense)
            .then(() =>{
                refreshApex(this.expenses);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'New Expenses Added',
                        variant: 'success',
                    }),
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error creating record',
                        message: error.body.message,
                        variant: 'error',
                    }),
                );
            });
        }
        refreshApex(this.expenses);
        this.pendingExpenses = [];
        this.newExpenses = [];
        this.updatedExpenses = [];
    }

    createExpense() {
        var newExpense = {};
        newExpense.ItemCost__r = {};
        newExpense.row = this.newExpenses.length+1;
        newExpense.Quantity = '1';
        newExpense.CustomPrice = true;
        newExpense.notCustomPrice = false;
        this.newExpenses.push(newExpense);
   }

    connectedCallback(){
        this.newExpenses = [];
        this.updatedExpenses = [];
        this.pendingExpenses = [];
        fetchWorkOrderIDs({id: this.recordId})
        .then(result => {
            if(result.length===1){
                this.workOrderId = result[0];
            } else if (result.length===0){
                this.workOrderId = 'none';
            } else if (result.length > 1){
                this.workOrderId = 'many';
            }            
        })
        .then(() =>{
            if(this.workOrderId !== 'none' && this.workOrderId !== 'many'){
                getItemOptionsForExpense({workOrderId: this.workOrderId})
                .then (result => {
                    this.itemList = result;
                });
            }
        });
    }

    get nameOptions(){
        return this.itemList;
    }

    renderedCallback(){
    }

    deleteLine(event) {
        var expenseID = event.currentTarget.dataset.recid;
        deleteRecord(expenseID)
        .then(() => {
            refreshApex(this.expenses);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Expense Is Deleted',
                    variant: 'success',
                }),
            );
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error while deleting Expense',
                    message: error.message,
                    variant: 'error',
                }),
            );
        });
    }

    deleteNewLine(event) {
        var row = event.currentTarget.dataset.row;

        this.newExpenses = this.newExpenses.filter(function( exp ) {
            return exp.row != row;
        });
    }

    //  Keep HTML and js Variables in Sync:
    updateValue(event){
        var expenseID = event.currentTarget.dataset.recid;
        var foundIt = false;
        var names = this.nameOptions;
        var label;
        this.template.querySelector('.undoButton').disabled = false;

        if(event.target.dataset.field === 'ItemCost__c'){
            // loop through this.nameOptions to get the names of the options to compare to the value
            for (var i = 0 ; i < names.length; i++){
                if(names[i].value === event.detail.value) {
                    label = names[i].label;
                    break;
                }
            }

            //  Disable/enable the price/quantity fields
            if(event.detail.value === '--None--'){
                this.template.querySelector(`[data-qtyid="${expenseID}"]`).disabled = true;
                this.template.querySelector(`[data-qtyid="${expenseID}"]`).value = 1;
                this.template.querySelector(`[data-prcid="${expenseID}"]`).disabled = false;
            } else if(label.includes(' - $')) {
                this.template.querySelector(`[data-qtyid="${expenseID}"]`).disabled = false;
                this.template.querySelector(`[data-prcid="${expenseID}"]`).disabled = true;
            } else {
                this.template.querySelector(`[data-qtyid="${expenseID}"]`).disabled = true;
                this.template.querySelector(`[data-prcid="${expenseID}"]`).disabled = false;
            }
        }
        for (var i = 0 ; i < this.updatedExpenses.length; i++){
            if(this.updatedExpenses[i].Id === expenseID){
                //  ... is standard JS "Spread" notation to represent an exploded array
                this.updatedExpenses[i] = {...this.updatedExpenses[i], [event.target.dataset.field] : event.detail.value}
                foundIt = true;
            }
        }
        if (!foundIt)
        {
            var updatedExpense = {};
            updatedExpense.Id = expenseID;
            updatedExpense[event.target.dataset.field] = event.detail.value;
            this.updatedExpenses.push(updatedExpense);
        }
    }

    updateNewValue(event){
        var foundIt = false;
        var names = this.nameOptions;
        var label;
        var expenseRow;

        // Set value to prevent duplicate rows from being saved
        if(event.currentTarget.dataset.row){
            expenseRow = event.currentTarget.dataset.row;
        } else {
            if(this.pendingExpenses.length)
                expenseRow = this.pendingExpenses.length + 1;
            else
                expenseRow = 1;
        }

        if(event.target.dataset.field === 'ItemCost__c'){

             // loop through this.nameOptions to get the names of the options to compare to the value
             for (var i = 0 ; i < names.length; i++){
                if(names[i].value === event.detail.value) {
                    label = names[i].label;
                    break;
                }
            }
            
            //  Disable/enable the price/quantity fields
            //  Disable/enable the price/quantity fields
            if(event.detail.value === '--NONE--'){
                this.template.querySelector(`[data-qtyrow="${expenseRow}"]`).disabled = true;
                this.template.querySelector(`[data-qtyrow="${expenseRow}"]`).value = 1;
                this.template.querySelector(`[data-prcrow="${expenseRow}"]`).disabled = false;
            } else if(label.includes(' - $')) {
                this.template.querySelector(`[data-qtyrow="${expenseRow}"]`).disabled = false;
                this.template.querySelector(`[data-prcrow="${expenseRow}"]`).disabled = true;
            } else {
                this.template.querySelector(`[data-qtyrow="${expenseRow}"]`).disabled = true;
                this.template.querySelector(`[data-prcrow="${expenseRow}"]`).disabled = false;
            }
        }
        for (var i = 0 ; i < this.pendingExpenses.length; i++){
            if(this.pendingExpenses[i].row == expenseRow){
                this.pendingExpenses[i] = {...this.pendingExpenses[i], [event.target.dataset.field] : event.detail.value}
                foundIt = true;
            }
        }
        if (!foundIt)
        {
            var newExpense = {};
            newExpense.row = expenseRow;
            newExpense.WorkOrderId = this.workOrderId;
            newExpense.RecordTypeId ='0121F000000DLt1QAG';
            newExpense[event.target.dataset.field] = event.detail.value;
            this.pendingExpenses.push(newExpense);
        }
    }

    undoChanges(){
        //  Let's set everything back to how we got it!
        // this.template.querySelector('.undoButton').disabled = true;
        // this.expenses = [];
        // refreshApex(this.expenses);
        // this.pendingExpenses = [];
        // this.newExpenses = [];
        // this.updatedExpenses = [];
        alert('This function still in development');
    }
}