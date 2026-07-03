import { LightningElement, api, wire, track } from 'lwc';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import DRAFT_OBJECT from '@salesforce/schema/Draft__c';
import WIRE_TYPE_FIELD from '@salesforce/schema/Draft__c.Wire_Type__c';
import getActivePaymentProcessors from '@salesforce/apex/ProgramPlanController.getActivePaymentProcessors';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import editPayments from '@salesforce/customPermission/Edit_Payments';
import skipValidation from '@salesforce/customPermission/Skip_Payment_Validation';
import Allow_Payment_AdHoc_Updates_in_Locked_Opp from '@salesforce/customPermission/Allow_Payment_AdHoc_Updates_in_Locked_Opp';
import enforceRetainerRange from '@salesforce/customPermission/Enforce_Retainer_Amount_Adjustment_Range';

import draftEdit from '@salesforce/customPermission/Draft_Edit';
import canUpdateProcessor from '@salesforce/customPermission/Update_Processor'; // Custom permission
import splitRetainerSetupFee from '@salesforce/customPermission/Split_Retainer_Setup_Fee';
import editProgramPlan from '@salesforce/customPermission/Edit_Program_Plan';
import showRescheduleButton from '@salesforce/customPermission/Show_Reschedule';
import {
    loadScript
} from "lightning/platformResourceLoader";
import momentJSFile from "@salesforce/resourceUrl/MomentJS";
import saveAndCreateSkippedPaymentDrafts from '@salesforce/apex/ProgramPlanController.createSkippedPaymentDrafts';
import syncDrafts from '@salesforce/apex/ProgramPlanController.syncDrafts';
import editPaymentRecord from '@salesforce/apex/ProgramPlanController.editPaymentRecord';
import debtChangeAlert from '@salesforce/label/c.DebtChangeAlert';
import paymentProcessorChangeAlert from '@salesforce/label/c.PaymentProcessorChangeAlert';
import nullRecordTypeId from '@salesforce/label/c.NullRecordTypeId';
import PAYMENT_FREQUENCY_FIELD from '@salesforce/schema/Program_Plan__c.Payment_Frequency__c';
import PAYMENT_TERM_FIELD from '@salesforce/schema/Program_Plan__c.Payment_Term__c';
import SETUP_FEE_FIELD from '@salesforce/schema/Program_Plan__c.Setup_Fee__c';
import SETTLEMENT_PERCENT_FIELD from '@salesforce/schema/Program_Plan__c.Settlement_Percentage__c';
import PROGRAM_FEE_PERCENT_FIELD from '@salesforce/schema/Program_Plan__c.Program_Fee_Percentage__c';
import RETAINER_PERCENT_FIELD from '@salesforce/schema/Program_Plan__c.Retainer_Percentage__c';
import NEXT_PAYMENT_DAY_FIELD from '@salesforce/schema/Program_Plan__c.Next_Payment_Day__c';
import SECOND_PAYMENT_DAY_FIELD from '@salesforce/schema/Program_Plan__c.Second_Payment_Day__c';
import WEEKLY_PAYMENT_DAY_FIELD from '@salesforce/schema/Program_Plan__c.Weekly_Payment_Day__c';
import legalPlanChangeAlert from '@salesforce/label/c.LegalPlanChangeAlert';
import getDebtDetails from '@salesforce/apex/ProgramPlanController.getDebtDetails';
import rescheduleProgram from '@salesforce/apex/ProgramPlanController.rescheduleProgram';
import saveProgram from '@salesforce/apex/ProgramPlanController.saveProgram';
import getPaymentCalcSettings from '@salesforce/apex/ProgramPlanController.getPaymentCalcSettings';
import getSetupFeeMapping from '@salesforce/apex/ProgramPlanController.getSetupFeeMapping';
import retrieveFeesFromOppProducts from '@salesforce/apex/ProgramPlanController.retrieveFeesFromOppProducts';
import getCurrentRecordDetails from '@salesforce/apex/ProgramPlanController.getCurrentRecordDetails';
import {  getNumberValue, formatDate } from "c/utils";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import LEGAL_PLAN_REQUIRED from "@salesforce/schema/Opportunity.Legal_Plan_Required__c";
import LEGAL_NETWORK from "@salesforce/schema/Opportunity.Legal_Network__c";
import PROCESSOR_STATUS from "@salesforce/schema/Opportunity.Account.Status__c";
import Draft_Status_Cancelled from '@salesforce/label/c.Draft_Status_Cancelled';
import Draft_Status_NSF from '@salesforce/label/c.Draft_Status_NSF';
import Draft_Status_Skipped from '@salesforce/label/c.Draft_Status_Skipped';
import STAGE_FIELD from '@salesforce/schema/Opportunity.StageName';
import WEEKLY_PAYMENT from '@salesforce/schema/Opportunity.Current_Weekly_Payment__c';
import FIRST_DEPOSIT_PAYMENT from '@salesforce/schema/Opportunity.DS_First_Deposit_Amount__c';
import LOCK_OPPORTUNITY from "@salesforce/schema/Opportunity.Lock_Opportunity__c";
import PARENT_OPPORTUNITY from "@salesforce/schema/Opportunity.Opportunity__c";
import ACCOUNT_FIELD from "@salesforce/schema/Opportunity.AccountId";
import logWiredDrafts from '@salesforce/customPermission/LogWiredDrafts';
import changeDayOfFutureDrafts from '@salesforce/customPermission/Change_Day_of_Future_Drafts';
import getWirePaymentFee from '@salesforce/apex/ProgramPlanController.getWirePaymentFee';
import upsertWireDraft from '@salesforce/apex/ProgramPlanController.upsertWireDraft';
import getWireDraftFiles from '@salesforce/apex/ProgramPlanController.getWireDraftFiles';
import deleteWireFiles from '@salesforce/apex/ProgramPlanController.deleteWireFiles';
import renameWireFiles from '@salesforce/apex/ProgramPlanController.renameWireFiles';
import linkWirePaymentFile from '@salesforce/apex/ProgramPlanController.linkWirePaymentFile';
import changeFutureDraftDays from '@salesforce/apex/ProgramPlanController.changeFutureDraftDays';
import { publish, MessageContext } from 'lightning/messageService';

import paymentTotals from '@salesforce/messageChannel/PaymentTotals__c';
import refreshSelected from '@salesforce/messageChannel/Refresh__c';
import programPlanModal from 'c/programPlanModal';
import getOpportunityBasedOnAccountId from '@salesforce/apex/ProgramPlanController.getOpportunityBasedOnAccountId'; 
import getProgramLengthsForAmount from '@salesforce/apex/ProgramPlanController.getProgramLengthsForAmount';
import getPaymentCalculatorSetting from '@salesforce/apex/ProgramPlanController.getPaymentCalculatorSetting';
import updatePaymentRecord from '@salesforce/apex/ProgramPlanController.updatePaymentRecord';
import RECORDTYPE_DEVNAME from "@salesforce/schema/Opportunity.RecordType.DeveloperName";

export default class ProgramPlans extends LightningElement {
    @api recordId;
    @track programPlanData = {};
    @track paymentFrequencies;
    @track paymentTerms;
    @track setupFeeValues;
    @track settlementPercentages;
    @track programFeePercentages;
    @track retainerPercentages;
    @track recurringPaymentDays;
    @track secondPaymentDays;
    @track weeklyPaymentDays;
    retSetAvailableInDB;
    showSpinner;
    noOfDebts;
    totalDebt;
    totalDebtIncluded;
    renderNextPaymentDay = false;
    renderBiMonthlyPaymentDay = false;
    renderWeeklyPaymentDay = false;
    renderSplitModal = false;
    retainerFeeValue = 0.00;
    setupFeeValue = 0.00;
    totalRetainerSetupFee = 0.00;
    consentMovePayments = true;
    saveAction = false;
    isRetainerSplitMandatory = false;
    calculateTotalMap ;
    isRetainerPaymentDateChanged = false;
    stautsToSkipForRetainerFee = ['Completed', 'Processing', Draft_Status_NSF, Draft_Status_Cancelled,'Skipped Payment'];
    @track tempRetainerSetRecord={};
    @track tempInitialRetainerSetRecord={};
   @track updatedDraftIds = [];
    @track suggestedRetainerAmount = 0;
    @track adjustmentRange = 300; // Default, will be loaded from custom metadata
    @track minAllowedRetainerAmount = 0;
    hasRetainerAdjustmentPermission = enforceRetainerRange;
    label = {
        nullRecordTypeId,
        debtChangeAlert,
        paymentProcessorChangeAlert,
        legalPlanChangeAlert
    };
    @track totalRows=[];
    @track paymentRecords = [];
    @track parentTableRecords = [];
    @track retainerSetupFeeRecords = [];
    @track retainerSetupFeeRecordsClone = [];
    @track retSetRecord = {};
    @track disableProgramPlanPermission = true;
    maxFirstPaymentBusinessDays = 5; //Default to 5
    renderDataTable = true;
    showSaveReschedule = false;
    showSavePayments = false;
    showReschedule = false;
    showWarning = false;
    showPaymentProcChangeWarning = false;
    showLegalPlanRescheduleWaring = false;
    hasSaveError = false;
    _totalProgramFee = 0;
    _totalPaymentAmount = 0;
    _programPlanId;
    _paymentCalcSettingsWrap = {};
    _feeWrapper = {};
    _setupFeeWrapper ={};
    _retainerSetupFeeUniqueId;
    _dateOfFirstRetSetPayment;
    _dateOfLastRetSetPayment;
    rescheduledProgram = false;
    _editPaymentsPermission = false;
    _tempRetainerSetupSplitRecords = [];
    _citadelFee = 0;
    _additionalmMonthsForCitadelFee = 0;
    isLoaded = false;
    isFirstPaymentDateChanged = false;
   // allTotalDebt = 0;
    settingName = 'Enhanced_Payment_Calculator';
    renderEnhancedView = false;
    stautsToSkipForRetainer = [Draft_Status_NSF, Draft_Status_Cancelled,Draft_Status_Skipped];

   setupFee1 = 0.00;
   setupFee2 = 0.00;
   drecordId;
   isAccount= false;
   isRetainerChanged = false;
   selectedRecordId;
   isNewRecord = false;
   @track isLogWireSpinner = false;
   wireDraftDate = null;
   wireDraftAmount = null;
   wirePaymentFee = 0;
   wireLegalFeePaid = false;
   createdDraftId = null;
   editingWireDraftId = null;
   _pendingDocumentIds = null;
   uploadedWireFiles = [];
   existingWireFiles = [];
   showWireFileUpload = false;
   wireFormError = null;
   wireType = null;
   wireTypeOptions = [];
   _draftRecordTypeId = null;
   programLengths = [];
   bonusProgramLengths = [];
   showChangeDayModal = false;
   selectedWeeklyPaymentDay = null;
   _originalWeeklyPaymentDay = null;
   @track monthYearSetForCitadel =[];
    @track processorOptions = [];
    @track processorValue;

    @wire(MessageContext)
    messageContext;

    @wire(getObjectInfo, { objectApiName: DRAFT_OBJECT })
    wiredDraftObjectInfo({ data, error }) {
        if (data) {
            this._draftRecordTypeId = data.defaultRecordTypeId;
        } else if (error) {
            this._draftRecordTypeId = null;
        }
    }

    get _draftRecordTypeIdReactive() {
        return this._draftRecordTypeId;
    }

    @wire(getPicklistValues, { recordTypeId: '$_draftRecordTypeIdReactive', fieldApiName: WIRE_TYPE_FIELD })
    wiredWireTypeValues({ data, error }) {
        if (data) {
            this.wireTypeOptions = data.values.map(opt => ({ label: opt.label, value: opt.value }));
        } else if (error) {
            this.wireTypeOptions = [];
        }
    }

    isRetainerFullyPaid = false;

    @wire(getPaymentCalculatorSetting, { settingName: '$settingName' })
    wiredSetting({ error, data }) {
        if (data) {
            this.settingData = data;
            if(this.settingData.Active__c) {
                this.renderEnhancedView = true;
                this.maxFirstPaymentBusinessDays = this.settingData.First_Payment_Max_Business_Days__c ?? this.maxFirstPaymentBusinessDays;
                this.adjustmentRange = this.settingData.Retainer_Amount_Adjustment_Range__c;
            }
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.settingData = undefined;
        }
    }

    get isDisableOpp() {
        return this.isLockOpportunity || this.disableProgramPlanPermission;
    }

    getOpportunityBasedOnAccountIdRecord() {
        getOpportunityBasedOnAccountId({ accountId: this.recordId })
            .then(result => {
                this.drecordId = result.Id;
                this.queryDebtDetails();
                this.disableProgramPlanPermission = !editProgramPlan || this.isLockOpportunity;
                this.showSaveReschedule = false;
                this.showSavePayments = false;
                this.showReschedule = showRescheduleButton;
                this.isLoaded = true;

            })
            .catch(error => {
                // Handle error
                console.error('Error fetching Opportunity:', error);
            });
    }

    get isRetainerSplitRequired() {
        return (this.showLegalPlanRescheduleWaring || this.showWarning) && !this.isRetainerChanged;
    }

    get saveIsDisabled() {
        return this.isDisabled && !editPayments;
    }

    get isProcessorDisabled() {
        return (!canUpdateProcessor || this.isLockOpportunity) ? true : false;
    }


    connectedCallback() {

        this.loadActiveProcessors();

        Promise.all([
            loadScript(this, momentJSFile + '/moment/scripts/moment.min.js')
        ])
            .then(() => {
                if (this.recordId && this.recordId.startsWith('001')) {
                    this.isAccount = true;
                    this.getOpportunityBasedOnAccountIdRecord();
                } else {
                    this.drecordId = this.recordId;
                    this.queryDebtDetails();
                      this.fetchProgramLengths();
                    this.disableProgramPlanPermission = !editProgramPlan || this.isLockOpportunity;
                    this.showSaveReschedule = false;
                    this.showSavePayments = false;
                    this.showReschedule = showRescheduleButton;
                    this.isLoaded = true;
                }

        });
    }
    loadActiveProcessors() {
        getActivePaymentProcessors().then(result => {
            this.processorOptions = result.map(p => ({ label: p.Name, value: p.Id, monthlyBankFee: p.Monthly_Bank_Fee__c, bankSetupFee: p.Bank_Setup_Fee__c }));
        })
        .catch(error => {
            this.showToast('Error fetching active payment processors:', 'error', error);
        });
    }

     fetchProgramLengths() {
        if (!this.totalDebt) {
            this.error = 'Please provide a total amount.';
            this.programLengths = [];
            this.bonusProgramLengths = [];
            return;
        }

        getProgramLengthsForAmount({ totalAmount: this.totalDebt })
            .then((result) => {

            this.programLengths = (result.programLengths || []).map((term) => ({
                paymentTerm: term.trim(),
                selected: false
            }));

            this.bonusProgramLengths = (result.bonusProgramLengths || []).map((term) => ({
                paymentTerm: term.trim(),
                selected: false,
                initialSelected: true
            }));

            this.error = null;
        })
        .catch((error) => {
            this.error = error?.body?.message || 'Unknown error';
            this.programLengths = [];
            this.bonusProgramLengths = [];
        });
    }

    @wire(getRecord, {
        recordId: "$drecordId",
        fields: [LEGAL_PLAN_REQUIRED,LEGAL_NETWORK,PROCESSOR_STATUS,STAGE_FIELD,WEEKLY_PAYMENT,FIRST_DEPOSIT_PAYMENT,LOCK_OPPORTUNITY, PARENT_OPPORTUNITY, RECORDTYPE_DEVNAME, ACCOUNT_FIELD]
    })
    wiredOppRecord(result) {
        this.oppRecord = result;
        if (result.data) {
            this.querySetupFees();
        }
    }

    get recordTypeName() {
        return getFieldValue(this.oppRecord.data, RECORDTYPE_DEVNAME);
    }

    get isLockOpportunity() {
        return getFieldValue(this.oppRecord.data, LOCK_OPPORTUNITY);
    }

    get canLogWiredDraft() {
        return this.isLockOpportunity && logWiredDrafts;
    }

    get showChangeDayButton() {
        return this.isLockOpportunity && changeDayOfFutureDrafts;
    }

    get isProceedChangeDayDisabled() {
        return !this.selectedWeeklyPaymentDay || this.selectedWeeklyPaymentDay === this._originalWeeklyPaymentDay;
    }

    openChangeDayModal() {
        this._originalWeeklyPaymentDay = this.weeklyPaymentDay;
        this.selectedWeeklyPaymentDay = this.weeklyPaymentDay;
        const modal = this.template.querySelector('.changeDayModal');
        modal.show();
    }

    closeChangeDayModal() {
        this.selectedWeeklyPaymentDay = null;
        this._originalWeeklyPaymentDay = null;
        const modal = this.template.querySelector('.changeDayModal');
        modal.hide();
    }

    handleChangeDayWeeklyPaymentDay(event) {
        this.selectedWeeklyPaymentDay = event.detail.value;
        this.constructProgramPlanDataObj(event);
    }

    handleProceedChangeDay() {
        this.showSpinner = true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const skipStatuses = new Set(this.stautsToSkipForRetainerFee);

        const futureDraftIndexMap = [];
        this.paymentRecords.forEach((r, i) => {
            const draftDate = new Date(moment(r.paymentDate));
            if (!skipStatuses.has(r.draftStatus) && draftDate >= today) {
                futureDraftIndexMap.push({ index: i, draft: { ...r } });
            }
        });

        if (futureDraftIndexMap.length === 0) {
            this.showToast('Error', 'error', 'No future pending drafts to update.');
            this.showSpinner = false;
            this.closeChangeDayModal();
            return;
        }


        const newDayIndex = this.getDayName(this.selectedWeeklyPaymentDay);

        const completedDates = [...this.paymentRecords, ...this.retainerSetupFeeRecords]
            .filter(r => r.draftStatus === 'Completed' && r.paymentDate)
            .map(r => new Date(moment(r.paymentDate)));

        const mostRecentCompleted = completedDates.length > 0
            ? completedDates.reduce((latest, d) => d > latest ? d : latest)
            : null;

        let targetDay;
        if (mostRecentCompleted !== null) {
            const nextWeekSunday = new Date(mostRecentCompleted);
            nextWeekSunday.setDate(mostRecentCompleted.getDate() - mostRecentCompleted.getDay() + 7);
            nextWeekSunday.setHours(0, 0, 0, 0);
            targetDay = new Date(nextWeekSunday);
            targetDay.setDate(nextWeekSunday.getDate() + newDayIndex);
        } else {
            const baseDate = new Date(moment(this.firstPaymentDate));
            const dayForward = (newDayIndex - baseDate.getDay() + 7) % 7;
            targetDay = new Date(baseDate);
            targetDay.setDate(baseDate.getDate() + dayForward);
        }

        const startDate = new Date(targetDay);
        while (startDate <= today) {
            startDate.setDate(startDate.getDate() + 7);
        }

        const futureRetainerIndexMap = [];
        this.retainerSetupFeeRecords.forEach((r, i) => {
            const draftDate = new Date(moment(r.paymentDate));
            if (!skipStatuses.has(r.draftStatus) && draftDate >= today) {
                futureRetainerIndexMap.push({ index: i, draft: { ...r } });
            }
        });
        const retainerCount = futureRetainerIndexMap.length;

        const retainerWithNewDates = [...this.retainerSetupFeeRecords];
        futureRetainerIndexMap.forEach(({ index }, i) => {
            const newDate = new Date(startDate);
            newDate.setDate(startDate.getDate() + (i * 7));
            retainerWithNewDates[index] = {
                ...this.retainerSetupFeeRecords[index],
                paymentDate: formatDate(newDate, '/', 'YYYY-MM-DD')
            };
        });

        const {
            enrichedRecords: enrichedRetainerRecords,
            totalProcessorFee: retainerTotalProcessorFee,
            totalCitadelFee: retainerTotalCitadelFee,
            monthYearSetForCitadel: retainerMonthYearSet
        } = this.enrichRecordsWithProcessorAndCitadelFees(retainerWithNewDates, false, this._citadelFee);

        const updatedRetainerDrafts = futureRetainerIndexMap.map(({ index }) => ({
            ...enrichedRetainerRecords[index],
            serviceFee: 0
        }));
        const monthYearSetProcessor = new Set();
        const monthYearSetCitadel = new Set([
            ...this.paymentRecords
                .filter(r => skipStatuses.has(r.draftStatus) && (r.citaldelFee || 0) > 0)
                .map(r => this.getMonthYearValueFromDate(r.paymentDate)),
            ...retainerMonthYearSet
        ]);

        const updatedDrafts = futureDraftIndexMap.map(({ draft }, i) => {
            const newDate = new Date(startDate);
            newDate.setDate(startDate.getDate() + ((retainerCount + i) * 7));
            const updated = { ...draft };
            updated.paymentDate = formatDate(newDate, '/', 'YYYY-MM-DD');

            const monthYear = this.getMonthYearValueFromDate(updated.paymentDate);
            const isFirstOfMonth = !monthYearSetProcessor.has(monthYear);

            if (isFirstOfMonth) {
                monthYearSetProcessor.add(monthYear);
                updated.processorFee = (this.monthlyBankFee || 0);
            } else {
                updated.processorFee = 0;
            }

            updated.serviceFee = this.serviceFee || 0;

            if (isFirstOfMonth && !monthYearSetCitadel.has(monthYear)) {
                monthYearSetCitadel.add(monthYear);
                updated.citaldelFee = this.roundOffAmount(this._citadelFee || 0);
            } else {
                updated.citaldelFee = 0;
            }

            updated.paymentAmount = (updated.totalAmount || 0) - (updated.processorFee || 0) -
                (updated.serviceFee || 0) - (updated.citaldelFee || 0) - (updated.programFee || 0);

            return updated;
        });

        futureRetainerIndexMap.forEach(({ index }) => {
            this.retainerSetupFeeRecords[index] = enrichedRetainerRecords[index];
        });
        this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
        if (this.retSetRecord) {
            this.retSetRecord.processorFee = retainerTotalProcessorFee;
            this.retSetRecord.citaldelFee = retainerTotalCitadelFee;
            this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
        }
        this.monthYearSetForCitadel = [...retainerMonthYearSet];

        futureDraftIndexMap.forEach(({ index }, i) => {
            this.paymentRecords[index] = updatedDrafts[i];
        });
        this.paymentRecords = [...this.paymentRecords];
        this.programPlanData = { ...this.programPlanData, weeklyPaymentDay: this.selectedWeeklyPaymentDay };
        this.calculateAmountsAndBalances(false);
        this.groupParentTableRecords();

        const draftsToSave = [
            ...updatedRetainerDrafts.map(r => ({
                recordId: r.recordId,
                paymentDate: r.paymentDate,
                processorFee: r.processorFee,
                serviceFee: 0,
                citaldelFee: r.citaldelFee,
                paymentAmount: r.paymentAmount
            })),
            ...updatedDrafts.map(r => ({
                recordId: r.recordId,
                paymentDate: r.paymentDate,
                processorFee: r.processorFee,
                serviceFee: r.serviceFee,
                citaldelFee: r.citaldelFee,
                paymentAmount: r.paymentAmount
            }))
        ];

        changeFutureDraftDays({
            oppId: this.drecordId,
            updatedDrafts: JSON.stringify(draftsToSave),
            newPaymentDay: this.selectedWeeklyPaymentDay
        })
        .then(() => {
            this.showToast('Success', 'success', 'Draft schedule updated successfully.');
            this.closeChangeDayModal();
            this.queryDebtDetails();
        })
        .catch(error => {
            const msg = error?.body?.message || error?.message || 'Unknown error';
            this.showToast('Error', 'error', 'Failed to save draft schedule: ' + msg);
            this.showSpinner = false;
        });
    }

    get accountId() {
        return getFieldValue(this.oppRecord.data, ACCOUNT_FIELD);
    }

    get escrowAmount() {
        return (parseFloat(this.wireDraftAmount) || 0) - (parseFloat(this.wirePaymentFee) || 0);
    }

    get wireModalHeader() {
        return this.editingWireDraftId ? 'Edit Wire Draft' : 'Log Wire Draft';
    }

    getFileIcon(extension) {
        if (!extension) return 'doctype:attachment';
        const map = {
            pdf: 'doctype:pdf',
            xlsx: 'doctype:excel', xls: 'doctype:excel',
            docx: 'doctype:word', doc: 'doctype:word',
            jpg: 'doctype:image', jpeg: 'doctype:image', png: 'doctype:image', gif: 'doctype:image',
            csv: 'doctype:csv', txt: 'doctype:txt', zip: 'doctype:zip'
        };
        return map[extension.toLowerCase()] || 'doctype:attachment';
    }

    formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    get allWireFiles() {
        const existing = (this.existingWireFiles || []).map(f => ({
            documentId: f.documentId,
            name: f.name,
            extension: f.extension ? f.extension.toUpperCase() : '',
            iconName: this.getFileIcon(f.extension),
            formattedSize: this.formatFileSize(f.size)
        }));
        const existingIds = new Set(existing.map(f => f.documentId));
        const newUploads = (this.uploadedWireFiles || [])
            .filter(f => !existingIds.has(f.documentId))
            .map(f => ({
                documentId: f.documentId,
                name: f.name.endsWith(' (draft)') ? f.name : f.name + ' (draft)',
                extension: '',
                iconName: 'doctype:attachment',
                formattedSize: ''
            }));
        return [...existing, ...newUploads];
    }

    get todayDate() {
        return new Date().toISOString().split('T')[0];
    }

    get isLegalPlanRequired() {
        return getFieldValue(this.oppRecord.data, LEGAL_PLAN_REQUIRED);
    }
    get legalNetworkType() {
        return getFieldValue(this.oppRecord.data, LEGAL_NETWORK);
    }
    get processorStatus() {
        return getFieldValue(this.oppRecord.data, PROCESSOR_STATUS);
    }
     get stageValue() {
        return getFieldValue(this.oppRecord.data, STAGE_FIELD);
    }
     get weeklyPaymentValue() {
        return getFieldValue(this.oppRecord.data, WEEKLY_PAYMENT);
    }
      get firstDepositedPaymentValue() {
        return getFieldValue(this.oppRecord.data, FIRST_DEPOSIT_PAYMENT);
    }
    
    get parentOpportunity() {
        return getFieldValue(this.oppRecord.data, PARENT_OPPORTUNITY);
    }


    renderedCallback() {
        this.renderUIElementsBasedOnFrequency(); 
        this.tableComponent().refreshRowStyle();
    }

    get isDisabled() {
        return this.isLockOpportunity /*(this.stageValue == 'Closed Won - First Payment Completed' && !this.isAccount)*/ ? true : false;
    }

    get isProgramPlanEdit() {
        return this.disableProgramPlanPermission || this.isDisabled ;
    }

    recalculateProgram() {
        if (this.recordTypeName == 'Debt_Settlement' && !skipValidation &&  (!this.checkFirstPaymentDate(this.firstPaymentDate))) {
            return;
        }

        let completedRetainerDraftAmount = this.retainerSetupFeeRecords
            .filter(record => record.draftStatus == 'Completed')
            .reduce((sum, record) => sum + (record.totalAmount || 0), 0);

        let completedRetainerDraftCount = this.retainerSetupFeeRecords
            .filter(record => record.draftStatus === 'Completed').length;

        let { completedCount, completedAmount } = this.paymentRecords.reduce(
        (acc, record) => {
            if (record.draftStatus === 'Completed') {
                acc.completedCount += 1;
                acc.completedAmount += record.totalAmount || 0; 
            }
            return acc;
        },
        { completedCount: 0, completedAmount: 0 }
        );

        programPlanModal.open({
            size: 'medium',
            heading: 'Navigate to Record Page',
            description: 'Navigate to a record page by clicking the row button',
            paymentTerms: this.paymentTerms,
            paymentTerm: this.paymentTerm,
            setupFeeValues : this.setupFeeValues,
            setupFee : this.setupFee,
            retainerPercentValue: this.retainerPercentage,
            settlementPercentValue: this.settlementPercentage,
            programFeePercentValue: this.programFeePercentage,
            totalDebt : this.totalDebt,
            monthlyBankFee : this.monthlyBankFee,
            serviceFee : this.serviceFee,
            bankSetupFee : this.bankSetupFee,
            citadelFee:this._citadelFee,
            paymentFrequency: this.paymentFrequency,
            setupFeeValue:this.setupFeeValues,
            currentWeeklyPayment : this.weeklyPaymentValue,
            paymentTermRecords:this.programLengths,
            bonusProgramLengths : this.bonusProgramLengths,
            firstDepositedPaymentValue:this.firstDepositedPaymentValue,
            completedDraftAmount: completedAmount + completedRetainerDraftAmount,
            completedDraftCount : completedCount + completedRetainerDraftCount,
            completedRetainerDraftAmount :completedRetainerDraftAmount,
            completedRetainerDraftCount:completedRetainerDraftCount
        }).then((result) => {
            if(result) {
                this.programPlanData['paymentTerm']= result+'';
                this.template.querySelector('.paymentTerm').value = result+'';
                this.rescheduleProgram(false);
            }
        });
    }


    //Retrive the setup fee
    querySetupFees() {
        getSetupFeeMapping({ legalNetworkType: this.legalNetworkType })
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this._setupFeeWrapper = JSON.parse(result.data);
                this.setupFee1 = this._setupFeeWrapper.fee1;
                this.setupFee2 = this._setupFeeWrapper.fee2;
            } else {
                this.showToast('Get Setup Fee Mapping Failed', 'error', 'Error');
            }
        })
        .catch(error => {
            this.showToast('Get Setup Fee Mapping Failed', 'error', error);
            this.showSpinner = false;
        });
    }

    //Retrieve the Debt Details Aggregation
    queryDebtDetails() {
        this.showSpinner = true;
        getDebtDetails({ opportunityId: this.drecordId })
        .then((result) => {
            if (result.resultStatus == 'SUCCESS') {
                let debtAggregationWrapList = JSON.parse(result.data);
                debtAggregationWrapList.forEach((debtAggregationWrap) => {
                    this.noOfDebts = debtAggregationWrap['noOfDebts'];
                    this.totalDebt = debtAggregationWrap['totalDebt'];
                    //this.allTotalDebt= debtAggregationWrap['allTotalDebt'];
                })
                this.getPaymentCalculatorSettings();
                this.fetchProgramLengths();
                this.isRetainerChanged = false;
                this.isFirstPaymentDateChanged = false;
            } else {
                this.showToast('Get Debt Aggregation Result Failed', 'error', result.message);
            }
            this.showSpinner = false;
        })
        .catch((error) => {
            this.showToast('Get Debt Aggregation Result Failed', 'error', error);
            this.showSpinner = false;
        });
    }

    //Retrieve the service fee 
    getPaymentCalculatorSettings() {
        getPaymentCalcSettings()
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this._paymentCalcSettingsWrap = JSON.parse(result.data);
                this.serviceFee = this._paymentCalcSettingsWrap.serviceFee;
            } else {
                this.showToast('Get Payment Calculator Settings Details Failed', 'error', 'Error');
            }
            //this.getProgramPlanDetails();
            this.getFees();
            //this.getFees();
        }).catch(error => {
            this.showSpinner = false;
        });
    }

    //Retrieve the Citadel fee 
    getFees() {
        retrieveFeesFromOppProducts({ opportunityId: this.drecordId })
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                this._feeWrapper = JSON.parse(result.data);
                this._citadelFee = this._feeWrapper.citadelFee;
            } else {
                this.showToast('Retrieve Fees from Opportunity Products is Failed', 'error', 'Error');
            }
            this.getProgramPlanDetails();
        }).catch(error => {
            this.showToast('Get Fees from Opportunity Products is failed', 'error', error);
            this.showSpinner = false;
        });
    }

    //Retrieve the Program Plan Details
    getProgramPlanDetails() {
        getCurrentRecordDetails({oppId : this.drecordId})
        .then(result => {
            if (result.resultStatus == 'SUCCESS') {
                if (result.data) {
                    this.retainerSetupFeeRecords = [];
                    this.paymentRecords = [];
                    this.programPlanData = JSON.parse(result.data).prgmPlanWrapper;
                    this.processorValue = this.programPlanData['paymentProcessorId'];
                    this.totalDebtIncluded = this.programPlanData['totalDebt'];
                    //If the debt amount is added/updated in the debt details, but program plans are not rescheduled, it shows a warning message.
                    if (this.totalDebt != this.programPlanData['totalDebt']) {
                        this.showWarning = true;
                    }
                    if (this.programPlanData['rescheduleProgramPending']) {
                        this.showPaymentProcChangeWarning = true;
                    }
                    let programPlanSetupFee =  this.programPlanData['setupFee'];
                    this.programPlanData['setupFee'] = this.isLegalPlanRequired ? this.setupFee1 : this.setupFee2;
                    this.setupFeeValues = this.programPlanData['setupFee'];
                    //This error message will show, When legal plan is changed in opportunity  and program plans are not rescheduled
                    if(programPlanSetupFee != this.programPlanData['setupFee']) {
                        this.showLegalPlanRescheduleWaring = true;
                    }
                    //If the Program Plan and Payments are saved already to the DB
                    if (this.programPlanData['lastRescheduledById'] && this.programPlanData['lastRescheduledDateTime']) {
                        let retSetAvailableInDB = false;
                        let paymentsInDB = JSON.parse(result.data).draftWrappers;
                        paymentsInDB.forEach((paymentRecord) => {
                            //Collect the draft payments
                            if (!paymentRecord.retainerSetupFeeRecord) {
                                this.paymentRecords.push(paymentRecord);
                            } else { //Collect the retainer and setup fee record
                                retSetAvailableInDB = true;
                                this.retainerSetupFeeRecords.push(paymentRecord);
                            }
                        })
                        //If the retainer and setup fee record is available in DB
                        if (retSetAvailableInDB == true) {
                            this.constructRetSetRecordsForDBRecords();
                            this.recalculateRetSetChildRecords();
                            this.recalculateRetSetChildRecordsForDBRecords();
                            
                        } else { //If the retainer and setup fee record is not available in DB
                            this.constructRetSetRecords();
                        }
                        this.retSetAvailableInDB =  retSetAvailableInDB;
                        this.retainerSetupFeeRecordsClone = [...this.retainerSetupFeeRecords];
                        this.groupParentTableRecords();
                        this.showSpinner = false;
                        this.calculateRunningBalanceForDBRecords();
                    } 
                    //If the Program Plan and Payments are not saved to the DB
                    else {
                        //If the reschedule permission is enabled, do reschedule and construct the payments
                        if (this.showReschedule) {
                            this.rescheduleProgram();
                        } else {
                            this.showSpinner = false;
                        }
                    }
                    this.getTotalRows(this.parentTableRecords);
                    publish(this.messageContext, paymentTotals, this.calculateTotalMap);
                }
            } else {
                this.showToast('Get Program Plan Details Failed', 'error', error);
                this.showSpinner = false;
            }
        }).catch(error => {
            this.showSpinner = false;
        })
    }

    get isRetainerSplitRequired() {
        return (this.showLegalPlanRescheduleWaring || this.showWarning) && !this.isRetainerChanged;
    }

    rescheduleProgram() {
        if(!skipValidation &&  this.processorStatus == 'Hold') {
              this.showToast('Reschedule Program Failed', 'error', 'Processor Status is on Hold');
              return;
        }
        if(!skipValidation &&  this.isFirstPaymentDateChanged && !this.checkFirstPaymentDate(this.firstPaymentDate)) {
            return;
        }
        this.showSpinner = true;
        if (!this.showReschedule) {
            return;
        }
        let allCompleted = this.retainerSetupFeeRecords.every(record => (this.stautsToSkipForRetainerFee.indexOf(record.draftStatus) >= 0));
        if (this.isFirstPaymentDateChanged && !this.isRetainerPaymentDateChanged) {
            let paymentDate = new Date(moment(this.firstPaymentDate));
            let index = 0;
            this.retainerSetupFeeRecords.forEach((record) => {
                if (this.stautsToSkipForRetainerFee.indexOf(record.draftStatus) < 0) {

                    let currentDate = new Date(moment(paymentDate));
                    if (index == 1) {
                        currentDate.setDate(currentDate.getDate() + this.getNextDay(currentDate, this.getDayName(this.weeklyPaymentDay)));
                    } else if (index == 0) {
                        currentDate.setDate(currentDate.getDate());
                    } else {
                        currentDate.setDate(currentDate.getDate() + 7);
                    }
                    record['paymentDate'] = formatDate(currentDate, '/', 'YYYY-MM-DD');
                    paymentDate = currentDate;
                    index++;
                }
            });
       
        }
        
        this.isRetainerPaymentDateChanged = false; 
        this.rescheduledProgram = true;
        this._totalProgramFee = 0.00;
        this._totalPaymentAmount = 0.00;
        if (this.totalDebt > 0) {
            let paymentCalcElementsWrap = {
                'frequency' : this.programPlanData['paymentFrequency'],
                'paymentTerm' : this.programPlanData['paymentTerm'],
                'firstPaymentDate' : !allCompleted && this.retainerSetupFeeRecords.length ? this.retainerSetupFeeRecords[this.retainerSetupFeeRecords.length - 1].paymentDate : this.programPlanData['firstPaymentDate'],
                'firstPaymentDay' : this.programPlanData['nextPaymentDay'],
                'secondPaymentDay' : this.programPlanData['secondPaymentDay'],
                'weeklyPaymentDay' : this.programPlanData['weeklyPaymentDay'],
                'totalDebt' : this.totalDebt,
                'settlementPercent' :this.programPlanData['settlementPercentage'],
                'programFeePercent' : this.programPlanData['programFeePercentage'],
                'retainerPercent' : this.programPlanData['retainerPercentage'],
                'setupFee' : this.programPlanData['setupFee'],
                'serviceFee' : this.serviceFee,
                'citadelFee' : this._citadelFee,
                'isCompletedRetainer':allCompleted && (this.retainerSetupFeeRecords != null ? true : false) && (this.retainerSetupFeeRecords.length > 0 ? true : false),
                'monthlyBankFee' : this.programPlanData['monthlyBankFee'],
                'bankSetupFee' : this.programPlanData['bankSetupFee'],
                'businessClient' : true,
                'opportunityId' : this.programPlanData['opportunityId'],
                'parentProgramPlanId' : this.programPlanData['recordId'],
                'completedDraftsAmount' : this.programPlanData['completedDraftsAmount'],
                'completedDraftsCount' :this.programPlanData['completedDraftsCount'],
                'lastDraftCompletedDate' : this.programPlanData['lastCompletedDraftDate'],
                'additionalMonthForCitadelFee' : this._additionalmMonthsForCitadelFee,
                'monthYearSetForCitadel':JSON.stringify(this.monthYearSetForCitadel),
                'firstPaymentDateValue':this.retainerSetupFeeRecords.length ? this.retainerSetupFeeRecords[this.retainerSetupFeeRecords.length - 1].paymentDate : this.programPlanData['firstPaymentDate']
            };
            this.paymentRecords = [];

            rescheduleProgram({ paymentCalcElements: JSON.stringify(paymentCalcElementsWrap) })
            .then((result) => {
                if (result.resultStatus == 'SUCCESS') {
                    let paymentRecords = JSON.parse(result.data).payments;
                    let isRetainerTotalAmountRecalculate = false,completedAmount = 0;
                    if (this.retainerSetupFeeRecords.length == 0 && !(this.programPlanData['lastRescheduledById'] && this.programPlanData['lastRescheduledDateTime'])) {
                        let recordsToProcess = [];                          
                         paymentRecords.forEach((paymentRecord) => {
                            if (paymentRecord.retainerSetupFeeRecord) {
                                if(paymentRecord.draftStatus == 'Completed' || paymentRecord.draftStatus == 'Processing') {
                                    completedAmount += paymentRecord.totalAmount;
                                }
                                this.retainerSetupFeeRecords.push(paymentRecord);
                            } else {
                                recordsToProcess.push(paymentRecord);
                            }
                        })
                        if(this.retainerSetupFeeRecords.length) {
                            isRetainerTotalAmountRecalculate = true;
                            this.constructRetSetRecordsForDBRecords();
                            this.recalculateRetSetChildRecords();
                            this.recalculateRetSetChildRecordsForDBRecords();       
                            this.retSetAvailableInDB =  true;
                            this.retainerSetupFeeRecordsClone = [...this.retainerSetupFeeRecords];
                            this.groupParentTableRecords();
                        }
                        this.paymentRecords = recordsToProcess;
                    } else {
                        let recordsToProcess = [];
                        paymentRecords.forEach((paymentRecord) => {
                            if (!paymentRecord.retainerSetupFeeRecord) {
                                recordsToProcess.push(paymentRecord);
                            }
                        })
                        this.paymentRecords = recordsToProcess;
                    }
                    
                    
                    //let monthYearSetForCitadel = new Set(); 
                    //let setupFeeApplied = false;

                    /*this.retainerSetupFeeRecords= this.retainerSetupFeeRecords.map((rec) => {
                        const updatedRecord = { ...rec }; 
                        updatedRecord.citaldelFee = this.getCitadelFee(
                            rec,
                            setupFeeApplied,
                            this._citadelFee,
                            monthYearSetForCitadel
                        );
                        return updatedRecord;
                    });

                    this.paymentRecords = this.paymentRecords.map((rec) => {
                        const updatedRecord = { ...rec }; 
                        updatedRecord.citaldelFee = this.getCitadelFee(
                            rec,
                            setupFeeApplied,
                            this._citadelFee,
                            monthYearSetForCitadel
                        );
                        return updatedRecord;
                    });*/
                    this.calculateAmountsAndBalances(true);
                    
                    if(this.retainerSetupFeeRecords && this.retainerSetupFeeRecords.length && 
                        this.stautsToSkipForRetainerFee.indexOf(this.retainerSetupFeeRecords[0].draftStatus) < 0) {
                        this.constructRetSetRecords(false);
                    } else {
                         if(this.retainerSetupFeeRecords.length == 0) {
                             this.constructRetSetRecords(false);
                            this.recalculateRetSetChildRecords();
                        } else {
                            this.constructRetSetRecords(true);
                        }
                        
                       
                    }
                    this.groupParentTableRecords();
                    this.showSpinner = false;
                    this.showSaveReschedule = true;
                    this.getTotalRows(this.parentTableRecords);
                    
                    if(isRetainerTotalAmountRecalculate) {
                        this.retSetRecord.totalAmount = this.retSetRetainerFee + this.retSetSetupFee + this.retSetRecord.processorFee + this.retSetRecord.citaldelFee;  
                    }
                    if(isRetainerTotalAmountRecalculate && this.retainerSetupFeeRecords.length && completedAmount <= this.retSetRecord.totalAmount) {
                        this.isRetainerSplitMandatory = true;
                    }
                     if(!this.isNewRecord && (this.showLegalPlanRescheduleWaring || this.showWarning||  (this.isFirstPaymentDateChanged && !this.isRetainerPaymentDateChanged))) {
                        let setupFeeApplied = false;
                        this.calculateRetSetAmountsAndBalances();
                        const {
                                enrichedRecords,
                                totalProcessorFee,
                                totalCitadelFee,
                                monthYearSetForCitadel
                            } = this.enrichRecordsWithProcessorAndCitadelFees(this.retainerSetupFeeRecords, setupFeeApplied, this._citadelFee);
                        
                        if(this.retSetRecord.totalAmount == this.retSetRetainerFee + this.retSetSetupFee + totalProcessorFee + totalCitadelFee) {
                            
                            this.retainerSetupFeeRecords = enrichedRecords;
                            this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
                            this.calculateRetSetAmountsAndBalances();
                            this.isShowValidationOnRetainer = false;
                        } else {
                            let completedRetainerDraftAmount = this.retainerSetupFeeRecords
                                .filter(record => record.draftStatus == 'Completed')
                                .reduce((sum, record) => sum + (record.totalAmount || 0), 0);
                            let totalAmountToCheck = this.retSetRetainerFee + this.retSetSetupFee + totalProcessorFee + totalCitadelFee;
                            if(completedRetainerDraftAmount < totalAmountToCheck) {
                           
                            this.isShowValidationOnRetainer =  true;
                                this.retSetRecord.totalAmount = totalAmountToCheck;
                            this.showToast(
                                'Error',
                                'error',
                                'Retainer total Amount is changed to $' + this.retSetRecord.totalAmount +
                                ' and retainer amount is not splited correctly. Please check the retainer setup fee records.'
                            );
                            this.retSetRecord.citaldelFee = totalCitadelFee;
                            this.retSetRecord.processorFee = totalProcessorFee;

                            } else {
                                this.isRetainerFullyPaid = true;
                            }

                        }
                    }
                    
                    let completedRetainerDraftAmount = this.retainerSetupFeeRecords
                                .filter(record => record.draftStatus == 'Completed')
                                .reduce((sum, record) => sum + (record.totalAmount || 0), 0);
                    if(completedRetainerDraftAmount > this.retSetRecord.totalAmount) {
                        this.isRetainerFullyPaid = true;
                    }

                } else {
                    this.showToast('Reschedule Program Failed', 'error', error);
                    this.showSpinner = false;
                }
            }) 
            .catch((error) => {
                
                this.showToast('Reschedule Program Failed', 'error', error);
                this.showSpinner = false;
            })
        } else {
            this.showSpinner = false;
        }
    }
    roundOffAmount(value) {
        return Math.round(value * 100) / 100; // Rounds to 2 decimal places
    }
    getMonthYearValueFromDate(dateString) {
        const date =  new Date(moment(dateString));
        const month = date.getMonth() + 1; // Months are 0-based in JavaScript
        const year = date.getFullYear();
        return `${month.toString().padStart(2, '')}-${year}`;
    }

    // Function to calculate Citadel Fee
    getCitadelFee(draftWrap, setupFeeApplied, citadelFeeValue, monthYearSetForCitadel) {
        const monthYearString = this.getMonthYearValueFromDate(draftWrap.paymentDate);
        if (
            !setupFeeApplied &&
            (
                    (draftWrap.setupFee && draftWrap.setupFee > 0)
            )
        ) {
            monthYearSetForCitadel.add(monthYearString);
        }

   

        if (!monthYearSetForCitadel.has(monthYearString)) {
            monthYearSetForCitadel.add(monthYearString);
            return this.roundOffAmount(citadelFeeValue);
        }

        return 0.00;
    }

    calculateAmountsAndBalances(isReschedule) {
        let runningBalance = 0.00;
        let programFeeYetToCollect = this.getTotalProgramFee();
        let counter = 0, firstPaymentProgramFee= 0;

        this.paymentRecords.forEach((paymentRecord) => {
            if(paymentRecord.draftStatus=='Completed') {
                programFeeYetToCollect -= paymentRecord.programFee;
            }
        });
         if(programFeeYetToCollect  < 0) {
            programFeeYetToCollect = 0;
         }

        this.paymentRecords.forEach((paymentRecord) => {
            if(paymentRecord.draftStatus != Draft_Status_NSF && paymentRecord.draftStatus != Draft_Status_Cancelled && paymentRecord.draftStatus!='Skipped Payment'
                && paymentRecord.draftStatus != 'Completed') {
                
            let paymentAmountExceptFees = paymentRecord.totalAmount - paymentRecord.processorFee - paymentRecord.serviceFee - paymentRecord.citaldelFee;
            if (counter == 0) {
                paymentAmountExceptFees = paymentAmountExceptFees + this.bankSetupFee;
            }
            if(isReschedule) {
                let programFeeToCollect = paymentAmountExceptFees * (70/100);
                if (counter == 0) {
                    firstPaymentProgramFee = this.formatAmount(programFeeToCollect);
                }
                if (programFeeToCollect >= firstPaymentProgramFee) {
                    paymentRecord.paymentAmount += (programFeeToCollect - firstPaymentProgramFee);
                    programFeeToCollect = firstPaymentProgramFee;
                }
                if (programFeeToCollect < programFeeYetToCollect) {
                    if (programFeeYetToCollect > firstPaymentProgramFee) {
                        paymentRecord.programFee = this.formatAmount(firstPaymentProgramFee);
                    } else {
                        paymentRecord.programFee = this.formatAmount(programFeeToCollect);
                    }
                } else {
                    paymentRecord.programFee = this.formatAmount(programFeeYetToCollect);
                }
                programFeeYetToCollect -= paymentRecord.programFee;
            }
            paymentRecord.paymentAmount = this.formatAmount(paymentAmountExceptFees - paymentRecord.programFee);
            if (counter == 0) {
                paymentRecord.paymentAmount -= this.bankSetupFee;
            }
            counter++;
        }
            if(paymentRecord.draftStatus != Draft_Status_NSF && paymentRecord.draftStatus != Draft_Status_Cancelled  && paymentRecord.draftStatus!='Skipped Payment') {
            paymentRecord.runningBalance = this.formatAmount(parseFloat(runningBalance) + parseFloat(paymentRecord.paymentAmount));
            } else {
                paymentRecord.runningBalance = this.formatAmount(parseFloat(runningBalance));
            }
            if (this.saveAction == true) {
                paymentRecord.manuallyAdded = false;
            }
            runningBalance = paymentRecord.runningBalance;
       
        })
        this.paymentRecords = [...this.paymentRecords];
        this.groupParentTableRecords();
    }

    constructRetSetRecordsForDBRecords() {
        this.retSetRecord = this.getNewPaymentRow();
        let calculatedTotalAmount = this.formatAmount(this.totalDebt * (this.retainerPercentage / 100)) + this.formatAmount(this.setupFee);

        let completedTotalAmount = this.retainerSetupFeeRecords
            .filter(record => record.draftStatus === "Completed")  
            .reduce((sum, record) => sum + record.totalAmount, 0); 

        if (completedTotalAmount === calculatedTotalAmount) {
            this.retSetRecord.draftStatus = 'Completed';
        }

        let totalProcessorFee = 0, totalCitadelFee = 0;
        this.retainerSetupFeeRecords.map((rec) => {
            const updatedRecord = { ...rec };
            totalProcessorFee += updatedRecord.processorFee;
            totalCitadelFee += updatedRecord.citaldelFee;
        });
        this.retSetRecord.processorFee = totalProcessorFee;
        this.retSetRecord.citaldelFee = totalCitadelFee;
        this.retSetRecord.retSetRecord = true;
        this.retSetRecord.retainerSetupFeeRecord = true;
    }

    recalculateRetSetChildRecordsForDBRecords() {
        let runningBalance = 0.00;
        let totalRetainerFee = 0.00;
        let totalSetupFee = 0.00;
        this.retainerSetupFeeRecords.forEach((retainerSetupChildRecord) => {
            retainerSetupChildRecord.uniqueId = this.generateRandomString(15, "12345abcde");
            retainerSetupChildRecord.retainerSetupChildRecord = true;
            if(retainerSetupChildRecord.draftStatus != Draft_Status_NSF && retainerSetupChildRecord.draftStatus != Draft_Status_Cancelled  && retainerSetupChildRecord.draftStatus!='Skipped Payment') {
                retainerSetupChildRecord.runningBalance = runningBalance + retainerSetupChildRecord.totalAmount;
                totalRetainerFee += retainerSetupChildRecord.retainerFee;
                totalSetupFee += retainerSetupChildRecord.setupFee;
            } else {
                retainerSetupChildRecord.runningBalance = runningBalance;
            }
            runningBalance = retainerSetupChildRecord.runningBalance;
        })
        this.retSetRecord.totalAmount = runningBalance; 
        this.retSetRecord.retainerFee = totalRetainerFee; 
        this.retSetRecord.setupFee = totalSetupFee; 
        this.retSetRecord.paymentDate = this.retainerSetupFeeRecords[0].paymentDate;
        this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
        this.tableComponent().refreshRowStyle();
    }

    calculateRunningBalanceForDBRecords() {
        let runningBalance = 0.00;
        this.paymentRecords.forEach((paymentRecord) => {
            if(paymentRecord.draftStatus != Draft_Status_NSF && paymentRecord.draftStatus != Draft_Status_Cancelled  && paymentRecord.draftStatus!='Skipped Payment') {
            paymentRecord.runningBalance = this.formatAmount(parseFloat(runningBalance) + parseFloat(paymentRecord.paymentAmount));
            } else {
                paymentRecord.runningBalance = this.formatAmount(parseFloat(runningBalance));
            }
             
            runningBalance = paymentRecord.runningBalance;
        })
    }
    getDayName(dayOfWeek) {
        switch (dayOfWeek.toLowerCase()) {
            case "sunday":
                return 0;
            case "monday":
                return 1;
            case "tuesday":
                return 2;
            case "wednesday":
                return 3;
            case "thursday":
                return 4;
            case "friday":
                return 5;
            case "saturday":
                return 6;
            default:
                return -1; // Invalid day
        }
    }
    getNextDay(currentDate, dayOfWeek) {
        const currentDayOfWeek = currentDate.getDay();
        const difference = dayOfWeek - currentDayOfWeek;
        return difference + 7;
    } 
    getNextPaymentDate(currentDate, index) {
        const date = moment(currentDate);
        if (index === 0) {
            const nextDayOffset = this.getNextDay(date.toDate(), this.getDayName(this.weeklyPaymentDay));
            return date.add(nextDayOffset, 'days').toDate();
        }
        return date.add(7, 'days').toDate();
    }
    calculateTotalPaymentCount(retainerFee, setupFee, paymentAmount) {
        if (paymentAmount <= 0) {
            console.warn('Invalid payment amount for calculation');
            return 0;
        }
        return Math.round((retainerFee + setupFee) / paymentAmount);
    }
    calculateProcessorFee(index, record, monthYearSet) {
        const hasProcessorFee = this.getProcessorFee(record, monthYearSet);
        if (index === 0) {
            return this.monthlyBankFee + this.bankSetupFee;
        }
        return hasProcessorFee ? this.monthlyBankFee : 0;
    }
    getInitialPaymentDate() {
        const today = new Date();
        const userDate = new Date(moment(this.firstPaymentDate));
        if (userDate < today) {
            today.setDate(today.getDate() + 2);
            return moment(today).toDate();
        }
        return userDate;
    }
    getCompletedRetainerRecordCount() {
        return this.retainerSetupFeeRecords.filter(
            record => record.draftStatus === "Completed"
        ).length;
    }
    getSetupFeeValue(index, completedCount) {
        let setupFee = null;
        if (completedCount === 0) {
            setupFee = this.calculateSetupFee(index);
        } else if (completedCount < 2 && index === completedCount - 1) {
            setupFee = this.calculateSetupFee(index + 1);
        } 
        return setupFee;
    }

    generateBaseRetainerRecords(count, startDate) {
        const records = [];
        let date = new Date(startDate); 
        
        const completedCount = this.getCompletedRetainerRecordCount();

        for (let i = 0; i < count; i++) {
            let setupFee = this.getSetupFeeValue(i, completedCount);
            const newRecord = {
                ...this.getNewPaymentRow(),
                paymentDate: formatDate(date, '/', 'YYYY-MM-DD'),
                retainerSetupChildRecord: true,
                ...(setupFee !== null && { setupFee }) 
            };
            
            records.push(newRecord);
            
            date = this.getNextPaymentDate(date, i); 
        }
        
        return records;
    }

    autoSplit() {
        this.tempRetainerSetRecord = {...this.retSetRecord};
        let retainerFee = this.retSetRetainerFee || 0;
        let setupFee = this.retSetSetupFee || 0;
        let paymentAmount = this.paymentRecords?.[0]?.totalAmount || 1;
        let totalPaymentCount = this.calculateTotalPaymentCount(retainerFee, setupFee, paymentAmount);        
        let retainerRecords = [];
        let paymentDate = this.getInitialPaymentDate();
        const completedCount = this.getCompletedRetainerRecordCount();

        let monthYearSetForCitadelTotal = new Set(), isSetupFeeCollectedForTotal = false, totalCitadelFeeTemp = 0, totalProcessorFeeTemp = 0,
            retainerSetRecordsForTotal = [], monthYearSetProcessorForTotal = new Set(), setupFeeAppliedTotal = false;


        retainerSetRecordsForTotal = this.generateBaseRetainerRecords(totalPaymentCount, paymentDate);
        retainerSetRecordsForTotal.forEach((rec, index) => {
            let updatedRecord = { ...rec };

            updatedRecord.processorFee = this.calculateProcessorFee(index, updatedRecord, monthYearSetProcessorForTotal);
            totalProcessorFeeTemp += updatedRecord.processorFee;

            if (updatedRecord.setupFee && updatedRecord.setupFee > 0) {
                isSetupFeeCollectedForTotal = true;
            }
            if(completedCount >= 2) {
                if (!this.isLegalPlanRequired && index === 1) {
                    isSetupFeeCollectedForTotal = true;
                }
            }
        
            if (isSetupFeeCollectedForTotal) {
                updatedRecord.citaldelFee = this.getCitadelFee(
                    updatedRecord,
                    setupFeeAppliedTotal,
                    this._citadelFee,
                    monthYearSetForCitadelTotal
                );
                totalCitadelFeeTemp += updatedRecord.citaldelFee;
            }
        });

        let totalamt = (this.retSetRetainerFee + this.retSetSetupFee) + totalProcessorFeeTemp + totalCitadelFeeTemp;
        let runningBalance = 0;
        let totalAmount = this.formatAmount(totalamt / totalPaymentCount);
        let retienerRecordsToAdd = [];
        let completedPaymentAmount = 0, nonCompletedCount = 0,completedPaymentCount = 0;

        if (this.retSetAvailableInDB) {
            for (let i = 0; i < this.retainerSetupFeeRecordsClone.length; i++) {
                if (this.stautsToSkipForRetainerFee.indexOf(this.retainerSetupFeeRecordsClone[i].draftStatus) >= 0) {
                    retienerRecordsToAdd.push(this.retainerSetupFeeRecordsClone[i]);
                }
                if (this.retainerSetupFeeRecordsClone[i].draftStatus == 'Completed' || this.retainerSetupFeeRecordsClone[i].draftStatus == 'Processing') {
                    completedPaymentAmount += this.retainerSetupFeeRecordsClone[i].totalAmount;
                    completedPaymentCount++;
                    runningBalance = this.retainerSetupFeeRecordsClone[i].totalAmount + runningBalance;
                    totalPaymentCount--;
                } 
                if (this.stautsToSkipForRetainerFee.indexOf(this.retainerSetupFeeRecordsClone[i].draftStatus) < 0) {
                    nonCompletedCount++;
            }
        }
           totalAmount = this.formatAmount(
                (totalamt - completedPaymentAmount) !== 0
                    ? (totalamt - completedPaymentAmount) / Math.max(1, totalPaymentCount)
                    : 0
            );

            this.suggestedRetainerAmount = totalAmount;
            this.minAllowedRetainerAmount = totalAmount - this.adjustmentRange;
            if(totalPaymentCount < 0) {
                /* totalPaymentCount is reassigned to 1 when its value is negative. 
                since totalPaymentCount is calculated based on First draft amount and the existing retainer payment records has more
                 than the split based on calculated  count*/
                totalPaymentCount = 1;
            }
            
        }
        if(this.retSetAvailableInDB && completedPaymentAmount >= this.retSetRecord.totalAmount) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Retainer Payment is already paid',
                    variant: 'error',
                }),
            );
            return;
        } else if(this.retSetAvailableInDB  
                    && completedPaymentAmount <= this.retSetRecord.totalAmount 
                    && nonCompletedCount == 0 && completedPaymentCount > totalPaymentCount) {
            totalPaymentCount = 1;
            totalAmount= totalamt - completedPaymentAmount;
        }
       
      for (let i = 0; i < totalPaymentCount; i++) {
        const setupFee = this.getSetupFeeValue(i, completedCount);

        let paymentForThisIteration = totalAmount;

        if (i === totalPaymentCount - 1) {
            const remaining = Math.max(0, totalamt - runningBalance);
            if (remaining < paymentForThisIteration) {
                paymentForThisIteration = remaining;
            }
        }


        runningBalance += paymentForThisIteration;

        const retSetRecord = {
            ...this.getNewPaymentRow(),
            paymentDate: formatDate(paymentDate, '/', 'YYYY-MM-DD'),
            totalAmount: paymentForThisIteration,
            runningBalance: runningBalance,
            retainerSetupChildRecord: true,
            isNew: true,
            ...(setupFee !== null && { setupFee })
        };

        retainerRecords.push(retSetRecord);
        paymentDate = this.getNextPaymentDate(paymentDate, i);
    }


        if (this.retSetAvailableInDB) {
            retainerRecords = [...retienerRecordsToAdd, ...retainerRecords];
        }
        let setupFeeApplied = false;
        let monthYearSetForCitadel = new Set(), isSetupFeeCollected = false, index = 0, totalProcessorFee = 0, totalCitadelFee = 0, monthYearSetProcessor = new Set();

        this.retainerSetupFeeRecords = retainerRecords.map((rec) => {

            const updatedRecord = { ...rec };
            if (index == 0) {
                updatedRecord.processorFee = this.monthlyBankFee + this.bankSetupFee;
                this.getProcessorFee(updatedRecord, monthYearSetProcessor);
            } else {
                if (this.getProcessorFee(updatedRecord, monthYearSetProcessor)) {
                    updatedRecord.processorFee = this.monthlyBankFee;
                } else {
                    updatedRecord.processorFee = 0;
            }
        }
            totalProcessorFee += updatedRecord.processorFee;
            if (updatedRecord.setupFee && updatedRecord.setupFee > 0) {
                isSetupFeeCollected = true
            }
            if (isSetupFeeCollected) {
                updatedRecord.citaldelFee = this.getCitadelFee(
                    rec,
                    setupFeeApplied,
                    this._citadelFee,
                    monthYearSetForCitadel
                );
                totalCitadelFee += updatedRecord.citaldelFee;
            }
            index++;
            return updatedRecord;
        });
        if (retainerRecords.length) {
            let lastIndex = retainerRecords.length - 1;
            if (this.retSetRecord.totalAmount < retainerRecords[lastIndex].runningBalance) {
                retainerRecords[lastIndex].totalAmount =  
                    this.formatAmount(retainerRecords[lastIndex].totalAmount + (this.retSetRecord.totalAmount - retainerRecords[lastIndex].runningBalance) + retainerRecords[lastIndex].citadelFee + retainerRecords[lastIndex].processorFee);
                retainerRecords[lastIndex].runningBalance =  retainerRecords[lastIndex].runningBalance + (this.retSetRecord.totalAmount - retainerRecords[lastIndex].runningBalance);
            }
        }

        this.retSetRecord.processorFee = totalProcessorFee;
        this.retSetRecord.citaldelFee = totalCitadelFee;
        this.retSetRecord.totalAmount = totalamt;
        this.monthYearSetForCitadel = [...monthYearSetForCitadel];
        this.calculateRetSetAmountsAndBalances();
    }
    
    calculateSetupFee(index) {
        if (this.isLegalPlanRequired && index === 0) {
            return this.programPlanData['setupFee'];
        }
        if (!this.isLegalPlanRequired && index === 1) {
            return this.programPlanData['setupFee'];
        }
        return null;
    }

    formatDate(date) {
        let month = date.getMonth() + 1; 
        let day = date.getDate();
        let year = date.getFullYear();
        month = month < 10 ? '0' + month : month;
        day = day < 10 ? '0' + day : day;
        return  year + '-' +month + '-' + day 
    }

    constructRetSetRecords(isNotApplyFirstPayment) {
        if (!this.retSetRecord.paymentDate) {
            this.retSetRecord = this.getNewPaymentRow();
        }
         if(!isNotApplyFirstPayment) {
            this.retSetRecord.paymentDate = this.firstPaymentDate;
        }
        
        this.retSetRecord.retainerFee = this.formatAmount(this.totalDebt * (this.retainerPercentage/100));
        this.retSetRecord.setupFee = this.formatAmount(this.setupFee);
        this.retSetRecord.retSetRecord = true;
        this.retSetRecord.showChild = false;
        if (this.retSetRecord.childrens && this.retSetRecord.childrens.length > 0) {
            let hasError = this.retainerSetupAmountCheck();
            if (hasError == false) {          
                this.retSetRecord.paymentColorCode = 'white';
                this.tableComponent().refreshRowStyle();
            }
        }
    }

    groupParentTableRecords() {
        this.parentTableRecords = [];
        this.parentTableRecords.push(this.retSetRecord);
        this.parentTableRecords = [...this.parentTableRecords, ...this.paymentRecords];
    }

    handleParentTableInputChange(event) {
        if (event.detail.fieldName == 'totalAmount') {
            let paymentRecord = this.paymentRecords[event.detail.parentRowIndx-1];
            let paymentAmount = parseFloat(event.detail.value);
            paymentRecord.totalAmount = paymentAmount;
            this.calculateAmountsAndBalances();
        } else if (event.detail.fieldName == 'paymentDate') {
            let paymentRecord = this.paymentRecords[event.detail.parentRowIndx-1];
            let paymentDate = event.detail.value;
            paymentRecord.paymentDate = paymentDate ? paymentDate : null;
        }
        let updatedPaymentRecord = this.paymentRecords[event.detail.parentRowIndx-1];
        this.updatedDraftIds.push(updatedPaymentRecord.recordId);
        if(!skipValidation) {
            this.validatePaymentRecord(this.paymentRecords[event.detail.parentRowIndx-1], event.detail.parentRowIndx-1);
        } else {
            this.removeRecordError( event.detail.parentRowIndx-1);
        }
       
        this.getTotalRows(this.parentTableRecords);
    }

    validatePaymentRecord(paymentRecord, index) {
        if (this.validatePaymentRecordCriteria(paymentRecord) || this.validatePaymentRecordCriteriaProgramFee(paymentRecord)) {
            this.makeRecordError(index);
        } else {
            this.removeRecordError(index);
        }
    }

    validateRSPaymentRecord(paymentRecord, index) {
        if (this.validatePaymentRecordCriteria(paymentRecord)) {
            this.makeRSRecordError(index);
        } else {
            this.removeRSRecordError(index);
        }
    }

    validatePaymentRecordCriteria(paymentRecord) {
        return this.validatePaymentAmount(paymentRecord) || this.validatePaymentDate(paymentRecord);
    }

    validatePaymentRecordCriteriaProgramFee(paymentRecord) {
        return this.validatePaymentAmountProgramFee(paymentRecord);
    }

    validatePaymentAmount(paymentRecord) {
        return paymentRecord.totalAmount <= 0;
    }

    validatePaymentDate(paymentRecord) {
        return this.stautsToSkipForRetainerFee.indexOf(paymentRecord.draftStatus) <= -1 &&
         (paymentRecord.paymentDate == null || Date.parse(paymentRecord.paymentDate) < new Date().getTime());
    }

    validatePaymentAmountProgramFee(paymentRecord) {
        return paymentRecord.totalAmount < (paymentRecord.programFee + paymentRecord.processorFee + paymentRecord.serviceFee + paymentRecord.citaldelFee);
    }

     // Helper function to update payment date
     updatePaymentDate(record, skipPaymentDate, dayCount) {
        if (skipPaymentDate) {
            let newPaymentDate = new Date(skipPaymentDate);
            newPaymentDate.setDate(newPaymentDate.getDate() + dayCount);
            let formattedDate = newPaymentDate.toISOString().split('T')[0];
            record.paymentDate = formattedDate;
        }
    }

    selectedSkipPayment(index, isChild) {

        let skippedPaymentDate = '';

        if(isChild) {
            skippedPaymentDate = this.retainerSetupFeeRecords[index].paymentDate;
            this.retainerSetupFeeRecords.forEach(record => {
            if (record.draftStatus === 'Completed' || record.draftStatus === 'NSF' || record.draftStatus == 'Skipped Payment') {
                this.updatePaymentDate(record, '', 0);
            } else if (record.paymentDate > skippedPaymentDate) {
                this.updatePaymentDate(record, record.paymentDate, 7);
            }
        });
            
        }  else {
            skippedPaymentDate = this.paymentRecords[index].paymentDate;
        }

        this.paymentRecords.forEach(record => {
            if (record.draftStatus === 'Completed' || record.draftStatus === 'NSF' || record.draftStatus == 'Skipped Payment') {
                this.updatePaymentDate(record, '', 0);
            } else if (record.paymentDate > skippedPaymentDate) {
                this.updatePaymentDate(record, record.paymentDate, 7);
                this.updatedDraftIds.push(record.recordId);
            }
        });
        let draft = {};
        let recordId = '';
        if(isChild) {
            this.updatePaymentDate(this.retainerSetupFeeRecords[index], this.retainerSetupFeeRecords[index].paymentDate, 7);
            draft['payments'] = JSON.stringify(this.retainerSetupFeeRecords[index]);
            recordId = this.retainerSetupFeeRecords[index].recordId;
        } else {
            this.updatePaymentDate(this.paymentRecords[index], this.paymentRecords[index].paymentDate, 7);
            draft['payments'] = JSON.stringify(this.paymentRecords[index]);
            recordId = this.paymentRecords[index].recordId;
        }
        
        try {
            this.updatedDraftIds.push(recordId);
            updatePaymentRecord({ recordId: recordId, draftStatus: 'Skipped Payment' })
        .then(() => {
            if(isChild) {
                this.retainerSetupFeeRecords[index].draftStatus = 'Skipped Payment';
            } else {
                this.paymentRecords[index].draftStatus = 'Skipped Payment';
            }
            saveAndCreateSkippedPaymentDrafts({ draftRecord: JSON.stringify(draft) })
                .then((result) => {
                    if (result.resultStatus == 'SUCCESS') {
                        if (result.data) {
                            let resultData = JSON.parse(result.data);
                            let payments = resultData.draftPayment;
                            if(isChild) {
                                this.retainerSetupFeeRecords.splice(index, 1);
                                this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords, payments];
                            } else {
                                this.paymentRecords.splice(index, 1);
                                this.paymentRecords = [...this.paymentRecords, payments];
                            }
                            this.queryDebtDetails();
                            this.saveProgram();
                        }
                    }
                })
                .catch((error) => {
                    this.showSpinner = false;
                });
            
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to update record',
                    variant: 'error',
                }),
            );
        });


        }
        catch (error) {
        }
    }

    makeRecordError(index) {
        this.paymentRecords[index].paymentColorCode = '#ee8181';
        //this.hasSaveError = true;
        this.tableComponent().refreshRowStyle();
    }

    removeRecordError(index) {
        this.paymentRecords[index].paymentColorCode = 'white';
        this.hasSaveError = false;
        this.tableComponent().refreshRowStyle();
        if (!this.showSaveReschedule) {
            this.showSavePayments = true;
        }
    }

    makeRSRecordError(index) {
        this.retainerSetupFeeRecords[index].paymentColorCode = '#ee8181';
        this.hasSaveError = true;
        this.template.querySelector('.retainerSetupFeeTable').refreshRowStyle();
    }

    removeRSRecordError(index) {
        this.retainerSetupFeeRecords[index].paymentColorCode = 'white';
        this.hasSaveError = false;
        this.template.querySelector('.retainerSetupFeeTable').refreshRowStyle();
    }

    closeModal() {
        const modal = this.template.querySelector('.editModal');
            modal.hide();
    }

    openLogWirePaymentModal() {
        this.wireDraftDate = null;
        this.wireDraftAmount = null;
        this.wirePaymentFee = 0;
        this.wireType = 'Regular';
        this.createdDraftId = null;
        this.editingWireDraftId = null;
        this._pendingDocumentIds = null;
        this.uploadedWireFiles = [];
        this.wireFormError = null;
        getWirePaymentFee({ opportunityId: this.drecordId })
            .then(result => { console.log('result++++',result); this.wirePaymentFee = result || 0; })
            .catch(() => { this.wirePaymentFee = 0; });
        const modal = this.template.querySelector('.logWirePaymentModal');
        modal.show();
    }

    openLogWirePaymentModalForEdit(row) {
        this.wireDraftDate = row.paymentDate;
        this.wireDraftAmount = row.paymentAmount + row.wireFee;
        this.wirePaymentFee = row.wireFee || 0;
        this.wireType = row.wireType || 'Regular';
        this.createdDraftId = null;
        this.editingWireDraftId = row.recordId;
        this._pendingDocumentIds = null;
        this.uploadedWireFiles = [];
        this.existingWireFiles = [];
        this.wireFormError = null;
        getWireDraftFiles({ draftId: row.recordId })
            .then(files => { this.existingWireFiles = files || []; })
            .catch(() => { this.existingWireFiles = []; });
        const modal = this.template.querySelector('.logWirePaymentModal');
        modal.show();
    }

    closeLogWirePaymentModal() {
        if (this.uploadedWireFiles.length > 0) {
            const ids = this.uploadedWireFiles.map(f => f.documentId);
            this.isLogWireSpinner = true;
            deleteWireFiles({ contentDocumentIds: ids })
                .catch(() => {this.isLogWireSpinner = false;})
                .finally(() => {
                    this._resetAndHideWireModal();
                });
        } else {
            this._resetAndHideWireModal();
        }
    }

    _resetAndHideWireModal() {
        this.isLogWireSpinner = false;
        this.createdDraftId = null;
        this.editingWireDraftId = null;
        this._pendingDocumentIds = null;
        this.uploadedWireFiles = [];
        this.existingWireFiles = [];
        this.wireLegalFeePaid = false;
        const modal = this.template.querySelector('.logWirePaymentModal');
        modal.hide();
    }

    handleWireLegalFeePaidChange(event) {
        this.wireLegalFeePaid = event.detail.checked;
    }

    handleWireDraftDateChange(event) {
        this.wireDraftDate = event.detail.value;
    }

    handleWireTypeChange(event) {
        this.wireType = event.detail.value;
    }

    handleWireFieldChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.detail.value;
    }

    saveWireDraft() {
        this.wireFormError = null;
        if (!this.wireDraftDate || this.wireDraftDate > this.todayDate) {
            this.wireFormError = 'Wire Draft Date is required and must be today or a past date.';
            return;
        }
        if (!this.wireDraftAmount || parseFloat(this.wireDraftAmount) <= 0) {
            this.wireFormError = 'Wire Draft Amount is required and must be greater than 0.';
            return;
        }
        if (!this.wireType) {
            this.wireFormError = 'Wire Type is required.';
            return;
        }
        this.isLogWireSpinner = true;
        const draft = {
            Draft_Date__c: this.wireDraftDate,
            Draft_Amount__c: this.escrowAmount,
            Wire_Fee__c: parseFloat(this.wirePaymentFee) || 0,
            DS_Escrow_Amount__c: this.escrowAmount,
            Draft_Status__c: 'Completed',
            Wire_Type__c: this.wireType || null,
            Wire_Payment__c: true,
            Legal_Fee_Paid__c: this.wireLegalFeePaid,
            Draft_Cleared_Date__c : this.wireDraftDate,
            sObjectType:'Draft__c'
        };

        if (this.editingWireDraftId) {
            draft.Id = this.editingWireDraftId;
            upsertWireDraft({ draft })
                .then(() => {
                    this.isLogWireSpinner = false;
                    this._finalizeSavedFiles();
                    this.closeLogWirePaymentModal();
                    this.getProgramPlanDetails();
                })
                .catch(error => {
                    this.isLogWireSpinner = false;
                    this.wireFormError = error.body ? error.body.message : 'Error updating wire draft.';
                });
            return;
        }

        Object.assign(draft, {
            Program_Plan__c: this.programPlanData['recordId'],
            Program_Fee__c: 0,
            Retainer_Fee__c: 0,
            Setup_Fee__c: 0,
            Processor_Fee__c: 0,
            Service_Fee__c: 0,
            Citadel_Fee__c: 0
        });

        upsertWireDraft({ draft })
            .then(draftId => {
                this.isLogWireSpinner = false;
                this.createdDraftId = draftId;
                if (this._pendingDocumentIds && this._pendingDocumentIds.length > 0) {
                    linkWirePaymentFile({
                        contentDocumentIds: this._pendingDocumentIds,
                        opportunityId: null,
                        accountId: null,
                        draftId
                    }).then(result => {
                        this._finalizeSavedFiles();
                        this.closeLogWirePaymentModal();
                        this.queryDebtDetails();
                    }).catch(error => {
                        console.error('Error linking wire payment files to draft:', error);
                    });
                    this._pendingDocumentIds = null;
                } else {
                    this._finalizeSavedFiles();
                    this.closeLogWirePaymentModal();
                    this.queryDebtDetails();
                }
                
            })
            .catch(error => {
                this.isLogWireSpinner = false;
                this.wireFormError = error.body ? error.body.message : 'Error creating wire draft.';
            });
    }

    _finalizeSavedFiles() {
        if (this.uploadedWireFiles.length > 0) {
            const ids = this.uploadedWireFiles.map(f => f.documentId);
            renameWireFiles({ contentDocumentIds: ids, addSuffix: false }).catch(() => {});
        }
        this.uploadedWireFiles = [];
    }

    handleWireFileUploadFinished(event) {
        const files = event.detail.files;
        if (files && files.length > 0) {
            this.uploadedWireFiles = [
                ...this.uploadedWireFiles,
                ...files.map(f => ({ name: f.name, documentId: f.documentId }))
            ];
            const contentDocumentIds = files.map(f => f.documentId);
            renameWireFiles({ contentDocumentIds, addSuffix: true }).catch(() => {});
            const draftId = this.createdDraftId || this.editingWireDraftId;
            if (draftId) {
                linkWirePaymentFile({
                    contentDocumentIds,
                    opportunityId: null,
                    accountId: this.accountId,
                    draftId
                }).catch(error => {
                    console.error('Error linking wire payment files:', error);
                });
            } else {
                this._pendingDocumentIds = contentDocumentIds;
            }
        }
    }

    handleDeleteWireFile(event) {
        const documentId = event.currentTarget.dataset.documentId;
        deleteWireFiles({ contentDocumentIds: [documentId] })
            .then(() => {
                this.existingWireFiles = this.existingWireFiles.filter(f => f.documentId !== documentId);
                this.uploadedWireFiles = this.uploadedWireFiles.filter(f => f.documentId !== documentId);
            })
            .catch(error => {
                this.wireFormError = error.body ? error.body.message : 'Error deleting file.';
            });
    }

    handleWireFileDone() {
        this._finalizeSavedFiles();
        this.closeLogWirePaymentModal();
        this.queryDebtDetails();
    }

    handleWireFileSkip() {
        this._finalizeSavedFiles();
        this.closeLogWirePaymentModal();
        this.queryDebtDetails();
    }

    handleActionClick(event) {
         if (event.detail.actionId == 'Edit-PaymentRow') {
            if(event.detail.childRowIndx != null) {
                this.selectedRecordId = this.retSetRecord.childrens[event.detail.childRowIndx].recordId;
                const modal = this.template.querySelector('.editModal');
                modal.show();
            } else {
                const row = this.paymentRecords[event.detail.parentRowIndx - 1];
                if (row && row.wirePayment) {
                    this.openLogWirePaymentModalForEdit(row);
                } else {
                    this.selectedRecordId = row.recordId;
                    const modal = this.template.querySelector('.editModal');
                    modal.show();
                }
            }
         }
        if (event.detail.actionId == 'Split-RetainerSetupFee') {
            if(!skipValidation &&  this.isFirstPaymentDateChanged && !this.checkFirstPaymentDate(this.firstPaymentDate)) {
                return;
            }
            const modal = this.template.querySelector('.splitRetainerSetupFeeModal');
            modal.show();
            this.tempRetainerSetRecord = {...this.retSetRecord};
            this.recalculateRetSetChildRecords();
            this.constructRetSetRecords(true);
            this._tempRetainerSetupSplitRecords = JSON.parse(JSON.stringify(this.retainerSetupFeeRecords));
            this._suggestedRetainerPaymentAmount = this.computeSuggestedRetainerPerPayment();
            this.minAllowedRetainerAmount = this._suggestedRetainerPaymentAmount - this.adjustmentRange;

        } else if (event.detail.actionId == 'Add-PaymentRow') {
            this.paymentRecords.splice((event.detail.parentRowIndx), 0, this.getNewDraftPaymentRow());            
            this.makeRecordError(event.detail.parentRowIndx);
            this.paymentRecords = [...this.paymentRecords];
            this.showSavePayments = true;
            this.hasSaveError = false;
        }  else if (event.detail.actionId == 'Skip-PaymentRow') {
            if(event.detail.isChild) {
                this.selectedSkipPayment(event.detail.childRowIndx, true);
            } else {
                this.selectedSkipPayment(event.detail.parentRowIndx - 1, false);
            }
        } else if (event.detail.actionId == 'Delete-PaymentRow') {            
            this.paymentRecords.splice(event.detail.parentRowIndx - 1, 1);
            this.paymentRecords = [...this.paymentRecords];
            this.calculateAmountsAndBalances();
        } else if (event.detail.actionId == 'Add-RSPayment') {
            let newChildRecord = this.getNewPaymentRow();
            newChildRecord.retainerSetupChildRecord = true;
            this.retainerSetupFeeRecords.splice((event.detail.parentRowIndx + 1), 0, newChildRecord);
            this.makeRSRecordError(event.detail.parentRowIndx + 1);
            this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
            this.calculateRetSetAmountsAndBalances();
        } else if (event.detail.actionId == 'Delete-RSPayment') {
            this.retainerSetupFeeRecords.splice(event.detail.parentRowIndx, 1);
            this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
            this.calculateRetSetAmountsAndBalances();
        } else if (event.detail.actionId == 'Tree-RetainerSetupFee') {
            if(!this.retSetRecord.childrens ||  this.retSetRecord.childrens.length == 0) {
            this.constructRetSetRecords();
            this.recalculateRetSetChildRecords();
            this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
            } else {
                this.clearDummyRetSetRecords();
            }
            if (!this.retSetRecord.showChild) {
                this.retSetRecord.showChild = true;
            } else {
                this.retSetRecord.showChild = false;
            }
            this.retSetRecord = {...this.retSetRecord};
        }
        this.groupParentTableRecords();
    }

    computeSuggestedRetainerPerPayment() {
        const retainerFee = this.retSetRetainerFee || 0;
        const setupFee    = this.retSetSetupFee    || 0;

        // Use first active program draft totalAmount as the benchmark —
        // same as autoSplit's: let paymentAmount = this.paymentRecords?.[0]?.totalAmount || 1
        const firstActiveDraft = this.paymentRecords.find(r =>
            r.draftStatus !== 'Completed'          &&
            r.draftStatus !== Draft_Status_NSF     &&
            r.draftStatus !== Draft_Status_Cancelled &&
            r.draftStatus !== 'Skipped Payment'
        );
        const benchmarkPaymentAmount = firstActiveDraft
            ? (firstActiveDraft.totalAmount || 1)
            : 1;

        // Payment count — exact same formula as autoSplit
        let totalPaymentCount = this.calculateTotalPaymentCount(
            retainerFee,
            setupFee,
            benchmarkPaymentAmount
        );
        if (totalPaymentCount <= 0) totalPaymentCount = 1;

        // The total shown in the modal header IS the full retSetRecord.totalAmount.
        // Divide it equally — no deductions, no completed-payment adjustments.
        const suggestedPerPayment = this.formatAmount(
            (this.retSetRecord.totalAmount || 0) / totalPaymentCount
        );
        return suggestedPerPayment;
    }


    clearDummyRetSetRecords() {
        if (this.retainerSetupFeeRecords) {
            let retainerSetupFeeRecordsTemp = [];
            this.retainerSetupFeeRecords.forEach((retSetRecords) => {
                if (retSetRecords.totalAmount > 0) {
                    retainerSetupFeeRecordsTemp.push(retSetRecords);
                }
            })
            this.retainerSetupFeeRecords = [...retainerSetupFeeRecordsTemp];
        }
    }

    recalculateRetSetChildRecords() {
        let retSetChildRecords = [];
        let collectedAmount = 0.00;
        let amountYetToCollect = this.retSetRecord.totalAmount;
        //let amountToSplit = 500;
        //let noOfPays = this.retSetRecord.totalAmount / amountToSplit;
        let noOfPays = 1;
        if (this.retainerSetupFeeRecords.length <= 0) {
            this.retSetRecord.processorFee = (this.monthlyBankFee || 0) + this.bankSetupFee;
            this.retSetRecord.totalAmount = this.retSetRecord.retainerFee + this.retSetRecord.setupFee  + this.retSetRecord.processorFee;
            this.isNewRecord = true;
            for (let i = 0; i < noOfPays; i++) {
                let retSetChildRecord = this.getNewPaymentRow();
                retSetChildRecord.retainerSetupChildRecord = true;
                retSetChildRecord.processorFee =this.retSetRecord.processorFee;
                retSetChildRecord.retainerFee =this.retSetRecord.retainerFee;
                retSetChildRecord.setupFee =this.retSetRecord.setupFee;
                retSetChildRecord.totalAmount = this.retSetRecord.retainerFee + this.retSetRecord.setupFee  + this.retSetRecord.processorFee;
                retSetChildRecord.paymentDate = this.firstPaymentDate;
                /*if (amountToSplit < amountYetToCollect) {
                    retSetChildRecord.totalAmount = amountToSplit;
                } else {
                    retSetChildRecord.totalAmount = amountYetToCollect;
                }*/
                amountYetToCollect -= retSetChildRecord.totalAmount;
                if(retSetChildRecord.draftStatus != Draft_Status_NSF && retSetChildRecord.draftStatus != Draft_Status_Cancelled && retSetChildRecord.draftStatus != 'Skipped Payment') {
                    retSetChildRecord.runningBalance = collectedAmount + retSetChildRecord.totalAmount;
                } else {
                    retSetChildRecord.runningBalance = collectedAmount;
                }
                collectedAmount = retSetChildRecord.runningBalance;
                retSetChildRecords.push(retSetChildRecord);
            }
            //this.retSetRecord.childrens = [...retSetChildRecords];
            this.retainerSetupFeeRecords = [...retSetChildRecords];
        } else {
            this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
        }
        //this.groupParentTableRecords();
    }

    get showRescheduleButton() {
        return this.showReschedule;
    }

    get showSaveRescheduleButton() {
        return this.hasSaveError == false && this.showSaveReschedule;
    }

    get showSavePaymentsButton() {
        if (this.showSaveRescheduleButton) {
            return false;
        } else if (this.showSavePayments) {
            return skipValidation || !this.hasSaveError;
        }
        return false;
    }

    calculateRetSetAmountsAndBalances() {
        let collectedAmount = 0.00;
        let retainerFeeYetToCollect = this.formatAmount(parseFloat(this.getRetainerFee()));
        let setupFeeYetToCollect = this.formatAmount(parseFloat(this.setupFee));

        let counter = 0;
        this.retainerSetupFeeRecords.forEach((childPayment) => {
            if(childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled && childPayment.draftStatus != 'Skipped Payment') {
                childPayment.runningBalance = collectedAmount + childPayment.totalAmount;
                collectedAmount += childPayment.totalAmount;
            } else {
                childPayment.runningBalance = collectedAmount;
            }
            let totalAmountToCollect = this.formatAmount(childPayment.totalAmount);

            //If counter means the First payment check
            if (counter === 0 && childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled  && childPayment.draftStatus != 'Skipped Payment') {
                // TotalAmount to collect equals setupfee set the retainer fee 0
                if (setupFeeYetToCollect === totalAmountToCollect && this.isLegalPlanRequired) { 
                    childPayment.retainerFee = 0;
                } else {
                    // If Setup fee detucted on For First payment
                    if (this.isLegalPlanRequired) {
                        childPayment.retainerFee = retainerFeeYetToCollect < setupFeeYetToCollect
                            ? this.formatAmount(totalAmountToCollect - setupFeeYetToCollect)
                            : totalAmountToCollect === retainerFeeYetToCollect + setupFeeYetToCollect
                                ? this.formatAmount(retainerFeeYetToCollect)
                                : this.formatAmount(totalAmountToCollect - setupFeeYetToCollect);
                        if(this.isNewRecord && this.retainerSetupFeeRecords.length == 1) {
                            childPayment.retainerFee =  childPayment.retainerFee - (childPayment.processorFee || 0);
                        }
                    } else {
                        // If Setup fee not detucted on For First payment
                        childPayment.retainerFee = this.formatAmount(totalAmountToCollect);
                        if(this.isNewRecord && this.retainerSetupFeeRecords.length == 1) {
                            childPayment.retainerFee = this.formatAmount(totalAmountToCollect - setupFeeYetToCollect - (childPayment.processorFee || 0));
                        }
                    }
                }
                 //If counter means the Second payment check
            } else if (counter === 1 ) {
                    if(!this.isLegalPlanRequired) {
                        childPayment.retainerFee =  this.formatAmount(totalAmountToCollect - setupFeeYetToCollect);
                    } else {
                        childPayment.retainerFee = this.formatAmount(this.calculateRetainerFee(this.formatAmount(retainerFeeYetToCollect), this.formatAmount(totalAmountToCollect)));
                    }
            } else {
                childPayment.retainerFee = this.formatAmount(this.calculateRetainerFee(this.formatAmount(retainerFeeYetToCollect), this.formatAmount(totalAmountToCollect)));
               
            }
            if(retainerFeeYetToCollect >= totalAmountToCollect) {
                childPayment.retainerFee = childPayment.retainerFee - (childPayment.processorFee || 0) - (childPayment.citaldelFee || 0);
            }

            if(childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled  && childPayment.draftStatus != 'Skipped Payment') {
                retainerFeeYetToCollect -= childPayment.retainerFee;
                totalAmountToCollect -= childPayment.retainerFee;
            }

            childPayment.setupFee = 0;
            if(counter == 1 && !this.isLegalPlanRequired && childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled && childPayment.draftStatus != 'Skipped Payment') {
                childPayment.setupFee = setupFeeYetToCollect;
            }
            setupFeeYetToCollect -= childPayment.setupFee;
            if (counter == 0) {
                this.retSetRecord.paymentDate = childPayment.paymentDate;
                if(this.isLegalPlanRequired && childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled && childPayment.draftStatus != 'Skipped Payment') {
                    childPayment.setupFee = setupFeeYetToCollect;
                }
                if(this.isNewRecord && this.retainerSetupFeeRecords.length == 1) {
                    childPayment.setupFee = setupFeeYetToCollect;
                }
            }
             if(childPayment.draftStatus != Draft_Status_NSF && childPayment.draftStatus != Draft_Status_Cancelled && childPayment.draftStatus != 'Skipped Payment') {
                counter++;
             }
            
        })
        this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
        this.retSetRecord.childrens = [...this.retainerSetupFeeRecords];
    }

    calculateRetainerFee(retainerFeeYetToCollect, totalAmountToCollect) {
        if (retainerFeeYetToCollect === totalAmountToCollect) {
            return retainerFeeYetToCollect;
        } else {
            return retainerFeeYetToCollect > totalAmountToCollect
                ? totalAmountToCollect
                : retainerFeeYetToCollect;
        }
    }
    handleProcessorChange(event) {
        const newProcessorValue = event.detail.value;
        const oldProcessorValue = this.processorValue;
        
        this.processorValue = newProcessorValue;
        this.programPlanData.paymentProcessorId = newProcessorValue;
        
        this.showSpinner = true;
        
        try {
            let selectedProcessor = JSON.parse(JSON.stringify(this.processorOptions)).find(p => p.value === newProcessorValue);
            this.programPlanData.monthlyBankFee = selectedProcessor ? selectedProcessor.monthlyBankFee : null;
            this.programPlanData.bankSetupFee = selectedProcessor ? selectedProcessor.bankSetupFee : null;
                
                // Set flag to show warning for reschedule requirement
                this.showPaymentProcChangeWarning = true;
                
                // Mark program plan as requiring reschedule
                this.programPlanData.rescheduleProgramPending = true;
                
                // Refresh the component data to reflect the processor change
                this.refreshComponentData();
                
                // Dispatch custom event to notify parent components
                this.dispatchEvent(new CustomEvent('processorchange', {
                    detail: { 
                        oldValue: oldProcessorValue, 
                        newValue: newProcessorValue,
                        recordId: this.drecordId,
                        monthlyBankFee: this.monthlyBankFee,
                        bankSetupFee: this.bankSetupFee
                    }
                }));
                
                // Publish message to refresh other components
                publish(this.messageContext, refreshSelected, {
                    type: 'processor-change',
                    recordId: this.drecordId,
                    newProcessor: newProcessorValue,
                    monthlyBankFee: this.monthlyBankFee,
                    bankSetupFee: this.bankSetupFee
                });
        } catch(error) {
                // Error: Revert the local state and show error
                this.processorValue = oldProcessorValue;
                
                console.error('Error updating processor:', error);
                const errorMsg = error?.body?.message || error?.message || 'Unknown error occurred';
                this.showToast('Error', 'error', `Failed to update payment processor: ${errorMsg}`);
        } finally {
                this.showSpinner = false;
        }
    }
    
    // Method to refresh component data after processor change
    refreshComponentData() {
        // Force reactivity update for fee-dependent components
        this.programPlanData = { ...this.programPlanData };
        
        // Recalculate any processor-dependent calculations
        if (this.paymentRecords && this.paymentRecords.length > 0) {
            this.calculateAmountsAndBalances(false);
        }
        
        // Refresh retainer setup fee calculations if applicable
        if (this.retainerSetupFeeRecords && this.retainerSetupFeeRecords.length > 0) {
            this.calculateRetSetAmountsAndBalances();
        }
    }



    enrichRecordsWithProcessorAndCitadelFees(records, setupFeeApplied, citadelFee) {
        let monthYearSetForCitadel = new Set();
        let monthYearSetProcessor = new Set();
        let totalProcessorFee = 0;
        let totalCitadelFee = 0;
        let isSetupFeeCollected = false;

        const enrichedRecords = records.map((rec, index) => {
            const updatedRecord = { ...rec };

            if (index === 0) {
                updatedRecord.processorFee = this.monthlyBankFee + this.bankSetupFee;
                this.getProcessorFee(updatedRecord, monthYearSetProcessor);
            } else {
                updatedRecord.processorFee = this.getProcessorFee(updatedRecord, monthYearSetProcessor)
                    ? this.monthlyBankFee
                    : 0;
            }

            totalProcessorFee += updatedRecord.processorFee;

            if (updatedRecord.setupFee && updatedRecord.setupFee > 0) {
                isSetupFeeCollected = true;
            }

            if (isSetupFeeCollected) {
                updatedRecord.citaldelFee = this.getCitadelFee(
                    updatedRecord,
                    setupFeeApplied,
                    citadelFee,
                    monthYearSetForCitadel
                );
                totalCitadelFee += updatedRecord.citaldelFee;
            }

            return updatedRecord;
        });

        return {
            enrichedRecords,
            totalProcessorFee,
            totalCitadelFee,
            monthYearSetForCitadel: [...monthYearSetForCitadel]
        };
    }


    handleChildTableInputChange(event) {
        this.tempRetainerSetRecord = {...this.retSetRecord};
        if (event.detail.fieldName == 'totalAmount') {
            let paymentAmount = this.formatAmount(event.detail.value);
            this.retainerSetupFeeRecords[event.detail.parentRowIndx].totalAmount = paymentAmount ? paymentAmount : 0.00;
            
            this.calculateRetSetAmountsAndBalances();
            
            // Validate retainer amount adjustment inline (must be AFTER calculateRetSetAmountsAndBalances)
            this.validateRetainerAmountAdjustment(event.detail.parentRowIndx);
        } else if (event.detail.fieldName == 'paymentDate') {
            let paymentDate = event.detail.value;
            this.retainerSetupFeeRecords[event.detail.parentRowIndx].paymentDate = paymentDate ? paymentDate : null;
            this.isRetainerPaymentDateChanged = true;
            //this.retainerSetupFeeRecords = this.retainerSetupFeeRecords;
        this.validateRSPaymentRecord(this.retainerSetupFeeRecords[event.detail.parentRowIndx], event.detail.parentRowIndx);
        }
          
        let setupFeeApplied = false;
        const {
            enrichedRecords,
            totalProcessorFee,
            totalCitadelFee,
            monthYearSetForCitadel
        } = this.enrichRecordsWithProcessorAndCitadelFees(this.retainerSetupFeeRecords, setupFeeApplied, this._citadelFee);

        this.retainerSetupFeeRecords = enrichedRecords;
        this.retSetRecord.processorFee = totalProcessorFee;
        this.retSetRecord.citaldelFee = totalCitadelFee;
        this.retSetRecord.totalAmount = this.retSetRetainerFee + this.retSetSetupFee + totalProcessorFee + totalCitadelFee; 
        this.monthYearSetForCitadel = [...monthYearSetForCitadel];
    }
    
    // Validate retainer amount adjustment and highlight cell with red background
    validateRetainerAmountAdjustment(index) {
        // Only validate if user has the custom permission
        if (!this.hasRetainerAdjustmentPermission) {
            this.removeRSRecordError(index);
            return;
        }
        
        let record = this.retainerSetupFeeRecords[index];
        
        // Only validate non-completed records
        if (this.stautsToSkipForRetainerFee.indexOf(record.draftStatus) >= 0) {
            this.removeRSRecordError(index);
            return;
        }
        
        let adjustedTotal = record.totalAmount;
        
        // Validate against allowed range
        if (adjustedTotal < this.minAllowedRetainerAmount) {
            this.makeRSRecordError(index);
            // Force array update to trigger reactivity
            this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
            this.showToast('Validation Error', 'error', 
                `Adjustment exceeds allowed limit  $${this.minAllowedRetainerAmount.toFixed(2)}. Please contact your Manager for approval.`);
        } else {
            this.removeRSRecordError(index);
            // Force array update to trigger reactivity
            this.retainerSetupFeeRecords = [...this.retainerSetupFeeRecords];
        }
    }
    
    // Final validation before applying retainer setup fee
    validateFinalRetainerAdjustment() {
        // No restriction if user doesn't have the permission
        if (!this.hasRetainerAdjustmentPermission) {
            return true;
        }
        
        // Check all non-completed retainer records
        for (let record of this.retainerSetupFeeRecords) {
            if (this.stautsToSkipForRetainerFee.indexOf(record.draftStatus) >= 0) {
                continue; // Skip completed/cancelled records
            }
            
            if (record.totalAmount < this.minAllowedRetainerAmount ) {
                return false;
            }
        }
        
        return true;
    }
    checkFirstPaymentDate(firstPaymentDate) {
        let today = new Date();
        today.setHours(0, 0, 0, 0);

        let minDate = new Date(today);
        minDate.setDate(minDate.getDate() + 2);
        let maxDays = this.maxFirstPaymentBusinessDays; 
        let minDays = 2;
        let maxDate = this.addBusinessDays(today, maxDays);

        let dateToCheck = new Date(firstPaymentDate);
        dateToCheck.setHours(0, 0, 0, 0);

        let errorMessage = `First Payment Date must be between ${minDays} and ${maxDays} business days from today for Debt Settlement Opportunities.`;

        if (dateToCheck < minDate || dateToCheck > maxDate) {
            this.showToast('Error', 'error', errorMessage);
            return false;
        }

        return true;
    }

    addBusinessDays(date, days) {
        let result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() + 1);
            let day = result.getDay();
            if (day !== 0 && day !== 6) { 
                count++;
            }
        }
        return result;
    }

  getProcessorFee(draftWrap, monthYearSetProcessor) {
        const monthYearString = this.getMonthYearValueFromDate(draftWrap.paymentDate);
        if (!monthYearSetProcessor.has(monthYearString)) {
            monthYearSetProcessor.add(monthYearString);
            return true;
        }
        return false;
    }

 applyRetainerSetupFee() {
        let allCompleted = this.retainerSetupFeeRecords.every(record => record.draftStatus === "Completed");
        if(allCompleted) {
            this.showToast('Error', 'error', 'All Payments are Completed cant apply the Retainer');
            return;
        }
        
        // Final validation check for retainer adjustment
        if (this.hasRetainerAdjustmentPermission && !this.validateFinalRetainerAdjustment()) {
            this.showToast('Error', 'error', 
                `Adjustment exceeds allowed limit  $${this.minAllowedRetainerAmount.toFixed(2)}. Please contact your Manager for approval.`);
            return;
        }
        
        this.retainerSetupFeeRecords = this.sortRetainerSetupFeeRecords(this.retainerSetupFeeRecords);
       
        let firstPaymentDate;
        let monthYearCollection = [];
        let setupFeeApplied = false;
        let setupFeeAppliedMonthYear = '';
         const {
            enrichedRecords,
            totalProcessorFee,
            totalCitadelFee,
            monthYearSetForCitadel
        } = this.enrichRecordsWithProcessorAndCitadelFees(this.retainerSetupFeeRecords, setupFeeApplied, this._citadelFee);
       
        this.retainerSetupFeeRecords = enrichedRecords;
        this.retSetRecord.processorFee = totalProcessorFee;
        this.retSetRecord.citaldelFee = totalCitadelFee;
        for (let i = 0; i < this.retainerSetupFeeRecords.length; i++) {
            //this.retainerSetupFeeRecords[i].processorFee = this.processorFee;
            if (!firstPaymentDate && this.stautsToSkipForRetainerFee.indexOf(this.retainerSetupFeeRecords[i].draftStatus) < 0) {
                firstPaymentDate = this.retainerSetupFeeRecords[i].paymentDate;
            }
            if (setupFeeApplied) {
                let currentSetupFeeDate = new Date(this.retainerSetupFeeRecords[i].paymentDate);
                let currentSetupFeeMonthYear = currentSetupFeeDate.getMonth() + '-' + currentSetupFeeDate.getFullYear();
                if (currentSetupFeeMonthYear != setupFeeAppliedMonthYear) {
                    if(monthYearCollection.indexOf(currentSetupFeeMonthYear) === -1) {
                        monthYearCollection.push(currentSetupFeeMonthYear);
                    }
                }
            }
            if (this.retainerSetupFeeRecords[i].setupFee && this.retainerSetupFeeRecords[i].setupFee > 0) {
                setupFeeApplied = true;
                let setupFeeDate = new Date(this.retainerSetupFeeRecords[i].paymentDate);
                setupFeeAppliedMonthYear = setupFeeDate.getMonth() + '-' + setupFeeDate.getFullYear();
            }

        }
        this.monthYearSetForCitadel = [...monthYearSetForCitadel];
        let records = this.retainerSetupFeeRecords.filter((record) => {
            return record.draftStatus != Draft_Status_NSF && record.draftStatus != Draft_Status_Cancelled  && record.draftStatus != 'Skipped Payment';
        });
        
        if (!this.isLegalPlanRequired) {
            const [secondPayment] = records.slice(1);
            if ((secondPayment?.retainerFee < 0)) {
                this.showToast('Error', 'error', `The second payment should be greater than ${this.setupFee} along with Bank fee`);
                return;
            }
        }

        //this._additionalmMonthsForCitadelFee = monthYearCollection.length;
        if (!skipValidation &&  (!this.checkFirstPaymentDate(firstPaymentDate) || this.retainerSetupAmountCheck() || this.retainerSetupDateCheck())) {
            return;
        }
        if (skipValidation || !this.retainerSetupAmountCheck() && !this.retainerSetupDateCheck()) {
            if (this.consentMovePayments) {
                let lastIndex = this.retainerSetupFeeRecords.length;
                this._dateOfFirstRetSetPayment = this.retainerSetupFeeRecords[0].paymentDate;
                this._dateOfLastRetSetPayment = this.retainerSetupFeeRecords[lastIndex - 1].paymentDate; 
                this.programPlanData['firstPaymentDate'] = firstPaymentDate;
                this.retSetRecord.childrens = this.retainerSetupFeeRecords;
                this.rescheduleProgram();
            } else {
                this.retSetRecord.childrens = this.retainerSetupFeeRecords;
                this.groupParentTableRecords();
            }
            this.showSavePayments = true;
            const modal = this.template.querySelector('.splitRetainerSetupFeeModal');
            modal.hide();
        }
        this.isRetainerChanged = true;
        this.isShowValidationOnRetainer = false;
        this.isRetainerSplitMandatory = false;
        this.calculateRetSetAmountsAndBalances();
        
        this.tempRetainerSetRecord = {...this.retSetRecord};
    }

    validateRetainerSetupAggregation() {
        return this.retainerSetupAmountCheck() && this.retainerSetupDateCheck();
    }

    retainerSetupAmountCheck() {

        let hasError = false;
        let lastIndex = this.retainerSetupFeeRecords.length;
        let records = this.retainerSetupFeeRecords.filter((record) => {
            return record.draftStatus != Draft_Status_NSF && record.draftStatus != Draft_Status_Cancelled  && record.draftStatus != 'Skipped Payment';
        });
        if (this.isLegalPlanRequired) {
            const [firstPayment] = records;
            if (firstPayment?.runningBalance < this.setupFee) {
                hasError = true;
                this.showToast('Error', 'error', `If Legal plan is there, the first payment should not be less than ${this.setupFee}`);
            }
        } else {
            const [secondPayment] = records.slice(1);
            if (this.retainerSetupFeeRecords.length <= 1 || (secondPayment?.totalAmount < this.setupFee)) {
                hasError = true;
                this.showToast('Error', 'error', `If Legal plan is not there, the second payment should be ${this.setupFee}`);
            }
        }
        
        if (!skipValidation &&  this.retainerSetupFeeRecords[lastIndex - 1]?.runningBalance.toFixed(2) != this.retSetRecord.totalAmount.toFixed(2)) {
            hasError = true;
            this.showToast('Error', 'error', 'The retainer and setup fee total amount is not correctly distributed');
        }
        return hasError;
    }

    retainerSetupDateCheck() {
        let hasError = false;
        this.retainerSetupFeeRecords.forEach((paymentRecord) => {
            if (this.validatePaymentRecordCriteria(paymentRecord)) {
                hasError = true;
                this.showToast('Error', 'error', 'Either one of the payments has a date in the past or an amount of zero or less.');
                return hasError;
            }
        })
        return hasError;
    }

    getTotalProgramFee() {
        return this.formatAmount(this.totalDebt * (this.programFeePercentage/100));
    }

    getTotalPaymentAmount() {
        return this.formatAmount(this.totalDebt * (this.settlementPercentage/100));
    }

    getRetainerFee() {
        return this.formatAmount(this.totalDebt * (this.retainerPercentage/100));
    }

    getNewPaymentRow() {
        return {
            uniqueId : this.generateRandomString(15, "12345abcde"),
            paymentDate : null,
            draftStatus : "Pending",
            paymentAmount : 0.00,
            programFee : 0.00,
            retainerFee : 0.00, 
            setupFee : 0.00,
            processorFee : 0.00, 
            citaldelFee:0.00,
            serviceFee : 0.00, 
            totalAmount : 0.00,
            runningBalance : 0.00,
            manuallyAdded : true
        };
    }

    getNewDraftPaymentRow() {
        return {
            uniqueId : this.generateRandomString(15, "12345abcde"),
            paymentDate : null,
            draftStatus : "Pending",
            paymentAmount : 0.00,
            programFee : 0.00,
            retainerFee : 0.00, 
            setupFee : 0.00,
            processorFee : 0.00, 
            citaldelFee:0.00,
            serviceFee : this.serviceFee, 
            totalAmount : 0.00,
            runningBalance : 0.00,
            manuallyAdded : true,
              programPlanId:this.programPlanData['recordId'],
            opportunityId:this.programPlanData['opportunityId']
        };
    }

    closeRetainerSetupFeeModal(event) {
        this.retainerSetupFeeRecords = this._tempRetainerSetupSplitRecords;
        this.retSetRecord.childrens = this._tempRetainerSetupSplitRecords;
        this.retSetRecord = {...this.tempRetainerSetRecord};
        this._tempRetainerSetupSplitRecords = [];
        const modal = this.template.querySelector('.splitRetainerSetupFeeModal');
        modal.hide();
    }

    generateRandomString(len, arr) {
        var ans = "";
        for (let i = len; i > 0; i--) {
            ans += arr[Math.floor(Math.random() * arr.length)];
        }
        return ans;
    }

    validateProgram() {
        this.showSpinner = true;
        let aggregaredProgramFee = 0.00;
        let aggregatedPaymentAmount = 0.00;
        let hasError = false;
        if (this.recordTypeName == 'Debt_Settlement' && !skipValidation &&  (!this.checkFirstPaymentDate(this.firstPaymentDate))) {
            hasError = true;
            this.showSpinner = false;
            return;
        }
        this.paymentRecords.forEach((paymentRecord) => {
            if (!skipValidation && this.validatePaymentRecordCriteria(paymentRecord)) {
                hasError = true;
                this.showToast('Error', 'error', 'Either one of the payments has a date in the past or an amount of zero or less.');
            } 
            if (!skipValidation && this.validatePaymentRecordCriteriaProgramFee(paymentRecord)) {
                hasError = true;
                this.showToast('Error', 'error', 'Either one of the payment amount is less than program fee.');
            }
            
            aggregaredProgramFee += paymentRecord.programFee;
            aggregatedPaymentAmount += paymentRecord.paymentAmount;
        })

        if(!this.isRetainerFullyPaid && (this.isRetainerSplitMandatory || (!this.isNewRecord && this.isRetainerSplitRequired))) {
                this.showToast('Error', 'error', 'Retiner Amount split is required before saving');
                hasError = true;
        }
        if(!this.isNewRecord && this.isShowValidationOnRetainer) {
            this.showToast(
                'Error',
                'error',
                'Retainer total Amount is changed to $' + this.retSetRecord.totalAmount +
                ' and retainer amount is not splited correctly. Please check the retainer setup fee records.'
            );

            hasError = true;
        }
        if(hasError) {
            this.showSpinner = false;
        }
        if (hasError == false) {
            this.saveProgram();
            /*let errorMsg = '';
            if (!(this.formatAmount(parseFloat(aggregaredProgramFee)) == this.formatAmount(parseFloat(this.getTotalProgramFee())))) {
                errorMsg += 'The distribution of program fee is not equal to the total program fee. Total Program Fee: ' + this.getTotalProgramFee() + '. Aggregation of Distributed Program Fee: ' + aggregaredProgramFee;
            } 
            if (!(this.formatAmount(parseFloat(aggregatedPaymentAmount)) == this.formatAmount(parseFloat(this.getTotalPaymentAmount())))) {
                errorMsg += 'The distribution of payment amount is not equal to the total payment amount. Total Payment Amount: ' + this.getTotalPaymentAmount() + '. Aggregation of Distributed Program Fee: ' + aggregatedPaymentAmount;
            }
            if (errorMsg) {
                this.showToast('Error', 'error', errorMsg);
            } else {
                //this.showToast('success', 'success', 'success');
                this.saveProgram();
            }*/
        }
    }

    saveProgram() {
        let programPlan = {};
        programPlan['program'] = JSON.stringify({
            'recordId': this.programPlanData['recordId'],
            'opportunityId':this.programPlanData['opportunityId'],
            'settlementPercentage' : this.programPlanData['settlementPercentage'],
            'programFeePercentage' : this.programPlanData['programFeePercentage'],
            'retainerPercentage' : this.programPlanData['retainerPercentage'],
            'paymentFrequency' : this.programPlanData['paymentFrequency'],
            'paymentTerm' : this.programPlanData['paymentTerm'],
            'setupFee' : this.programPlanData['setupFee'],
            'firstPaymentDate' : this.programPlanData['firstPaymentDate'],
            'nextPaymentDay' : this.programPlanData['nextPaymentDay'],
            'secondPaymentDay' : this.programPlanData['secondPaymentDay'],
            'weeklyPaymentDay' : this.programPlanData['weeklyPaymentDay'],
            'totalDebt' : this.totalDebt,
            'noOfDebts' : this.noOfDebts,
            'parentOpportunity': this.parentOpportunity
        });
        let finalPayments = [];
        if(this.programPlanData['paymentProcessorId']) {
            programPlan['paymentProcessorId'] = this.programPlanData['paymentProcessorId'];
        }

        if (this.retainerSetupFeeRecords && this.retainerSetupFeeRecords.length > 0) {
            if (this.retainerSetupFeeRecords[0].totalAmount > 0) {
                finalPayments = [...this.retainerSetupFeeRecords, ...this.paymentRecords];
            } else {
            this.retSetRecord.processorFee = (this.monthlyBankFee || 0) + this.bankSetupFee;
                let retSetTempArray = [this.retSetRecord];
                finalPayments = [...retSetTempArray, ...this.paymentRecords];
            }
        } else {
            this.retSetRecord.processorFee = (this.monthlyBankFee || 0) + this.bankSetupFee;
            let retSetTempArray = [this.retSetRecord];
            finalPayments = [...retSetTempArray, ...this.paymentRecords];
        }
        let finalPaymentsToSave = finalPayments.filter((record) => {
            if(record.retainerSetupChildRecord || (!record.retainerSetupChildRecord  && this.stautsToSkipForRetainerFee.indexOf(record.draftStatus) <= -1)) {
                return true;
            }
            return false;

        })
       
        let firstDraftAmount = this.paymentRecords[0].totalAmount;
        let firstRetSetFee;
        let retainerCompleted = false;
        if(this.retSetRecord.childrens && this.retSetRecord.childrens.length > 0) {
            for(let i=0; i < this.retSetRecord.childrens.length; i++){
                if( this.retSetRecord.childrens[i].draftStatus != 'NSF' && this.retSetRecord.childrens[i].draftStatus != 'Cancelled' && this.retSetRecord.childrens[i].draftStatus != 'Rejected' && this.retSetRecord.childrens[i].draftStatus != 'Completed' && this.retSetRecord.childrens[i].draftStatus != 'Skipped Payment'){
                    firstRetSetFee = this.retSetRecord.childrens[i].totalAmount;
                    retainerCompleted = true;
                    break;
                }
            }
        } else if(this.retSetRecord.childrens && this.retSetRecord.childrens.length == 0){
            firstRetSetFee = this.retSetRecord.totalAmount;
            retainerCompleted = true;
        }        

        if(!retainerCompleted && this.paymentRecords.length > 0){
            for(let i=0; i < this.paymentRecords.length; i++){
                if( this.paymentRecords[i].draftStatus != 'NSF' && this.paymentRecords[i].draftStatus != 'Cancelled' && this.paymentRecords[i].draftStatus != 'Rejected' && this.paymentRecords[i].draftStatus != 'Completed' && this.paymentRecords[i].draftStatus != 'Skipped Payment'){
                    firstRetSetFee = this.paymentRecords[i].totalAmount;
                    break;
                }
            }    
        }        

        if(!retainerCompleted && this.paymentRecords.length > 0){
            for(let i=0; i < this.paymentRecords.length; i++){
                if( this.paymentRecords[i].draftStatus != 'NSF' && this.paymentRecords[i].draftStatus != 'Cancelled' && this.paymentRecords[i].draftStatus != 'Rejected' && this.paymentRecords[i].draftStatus != 'Completed' && this.paymentRecords[i].draftStatus != 'Skipped Payment'){
                    firstRetSetFee = this.paymentRecords[i].totalAmount;
                    break;
                }
            }    
        }

        let { completedCount, completedAmount } = finalPayments.reduce(
        (acc, record) => {
            if (record.draftStatus === 'Completed') {
                acc.completedCount += 1;
                acc.completedAmount += record.totalAmount || 0; 
            }
            return acc;
        },
        { completedCount: 0, completedAmount: 0 }
        );

        programPlan['payments'] = JSON.stringify(finalPaymentsToSave);
        programPlan['firstDraftAmount'] = JSON.stringify(firstDraftAmount);
        programPlan['firstRetSetFee'] = JSON.stringify(firstRetSetFee);
        programPlan['firstPaymentDate'] = this.programPlanData['firstPaymentDate'];
        programPlan['completedCount'] = completedCount;
        programPlan['completedAmount'] = completedAmount;
        saveProgram({ programPlan: JSON.stringify(programPlan), updatedDraftIds: this.updatedDraftIds, isReschedule: this.showSaveReschedule })
        .then((result) => {
            if (result.resultStatus == 'SUCCESS') {
                this.queryDebtDetails();
                this.showToast('Success', 'success', 'Program Plan Details Saved Successfully.');
                this.showSaveReschedule = false;
                this.isRetainerSplitMandatory = false;
                this.showWarning = false;
                this.showPaymentProcChangeWarning = false;
                this.showLegalPlanRescheduleWaring = false;
                this.totalDebtIncluded = this.totalDebt;
                this.isRetainerChanged = false;
                this.isFirstPaymentDateChanged = false;
                this.isNewRecord = false;
                this.isShowValidationOnRetainer = false;
                this.isRetainerFullyPaid = false;
            } else {
                this.showToast('Save Program Failed', 'error', error);
            }
            this.showSpinner = false;
            publish(this.messageContext, refreshSelected, {});
            publish(this.messageContext, paymentTotals, this.calculateTotalMap);
        }) 
        .catch((error) => {
            this.showToast('Save Program Failed', 'error', error);
            this.showSpinner = false;
        })
    }

    savePayments() {
        this.showSpinner = true;
        this.saveAction = true;
        let programPlan = {};
        let finalPayments = [...this.retainerSetupFeeRecords, ...this.paymentRecords];
        let firstDraftAmount = this.paymentRecords[0].totalAmount;
        let firstRetSetFee = this.retSetRecord.childrens && this.retSetRecord.childrens.length > 0 ? 
            this.retSetRecord.childrens[0].totalAmount : this.retSetRecord.totalAmount;
        programPlan['firstDraftAmount'] = JSON.stringify(firstDraftAmount);
        programPlan['firstRetSetFee'] = JSON.stringify(firstRetSetFee);
        //Added Oppotunity Id - CRM-218
        programPlan['opportunityId'] = this.drecordId;
        programPlan['payments'] = JSON.stringify(finalPayments);
        programPlan['firstPaymentDate'] = this.programPlanData['firstPaymentDate'];
        let isPaymentDateNull = false;
        this.paymentRecords.forEach(record => {            
            if (record.paymentDate == null) {
                isPaymentDateNull = true;                
            }
        });
        if(isPaymentDateNull) {            
            this.showToast('Error', 'error', 'Payment Date should not be blank');
            this.showSpinner = false;
            return;
        }
        saveProgram({ programPlan: JSON.stringify(programPlan), updatedDraftIds: this.updatedDraftIds, isReschedule: this.showSaveReschedule })
        .then((result) => {
            if (result.resultStatus == 'SUCCESS') {
                this.calculateAmountsAndBalances();
                this.showToast('Success', 'success', 'Payment Details Saved Successfully.');
                this.showSavePayments = false;
                this.isRetainerSplitMandatory = false;
                this.saveAction = false;
            } else {
                this.showToast('Save Payments Failed', 'error', error);
            }
            publish(this.messageContext, refreshSelected, {});
            publish(this.messageContext, paymentTotals, this.calculateTotalMap);

            this.showSpinner = false;
        }) 
        .catch((error) => {
            this.showToast('Save Payments Failed', 'error', error);
            this.showSpinner = false;
        })
    }

    tableComponent() {
        return this.template.querySelector("c-datatable");
    }

    get tableProperties() {
        return {
            rowClass: '',
            headerClass: '',
            headerStyle: 'background-color: lightblue !important;',
            rowStyle: function (row) {
                if (row.retainerSetupChildRecord) {
                    return "background-color: lightblue;";
                }
                if(row.draftStatus == Draft_Status_NSF || row.draftStatus == Draft_Status_Cancelled  || row.draftStatus == 'Skipped Payment'){
                    return "color: red;background-color: "+ row.paymentColorCode + ";";
                }
                return "background-color: " + row.paymentColorCode + ";";
            },
            scrollable: true,
            scrollableHeight: "500px",
            isHighlightEdited: true,
            isEditAll: true,
            isEditAllOnLoad: true,
            isCalculateTotalRow:true,
            isWrapHeader:true
        }
    };

    get retainerSetupTableProperties() {
        let self = this;
        return {
            rowClass: '',
            headerClass: '',
            headerStyle: 'background-color: lightblue !important;',
            rowStyle: function (row) {
                if(row.draftStatus == Draft_Status_NSF || row.draftStatus == Draft_Status_Cancelled  || row.draftStatus == 'Skipped Payment'){
                    return "color: red;background-color: "+ row.paymentColorCode + ";";
                }
                return "background-color: " + row.paymentColorCode + ";";
            },
            scrollable: true,
            scrollableHeight: "500px",
            isHighlightEdited: true,
            isEditAll: true,
            isEditAllOnLoad: true
        }
    };

    get monthlyBankFee() {
        return this.programPlanData['monthlyBankFee'];
    }

    get bankSetupFee() {
        return this.programPlanData['bankSetupFee'];
    }

    get paymentProcessorName() {
        return this.programPlanData['paymentProcessorName'];
    }

    get paymentFrequency() {
        return this.programPlanData['paymentFrequency'];
    }

    get paymentTerm() {
        return this.programPlanData['paymentTerm'];
    }

    get setupFee() {
        return this.programPlanData['setupFee'];
    }

    get settlementPercentage() {
        return this.programPlanData['settlementPercentage'];
    }

    get programFeePercentage() {
        return this.programPlanData['programFeePercentage'];
    }

    get retainerPercentage() {
        return this.programPlanData['retainerPercentage'];
    }

    get firstPaymentDate() {
        return  this.programPlanData['firstPaymentDate'];
    }

    get nextPaymentDay() {
        return this.programPlanData['nextPaymentDay'];
    }

    get secondPaymentDay() {
        return this.programPlanData['secondPaymentDay'];
    }

    get weeklyPaymentDay() {
        return this.programPlanData['weeklyPaymentDay'];
    }

    get retSetRetainerFee() {
        return this.formatAmount(this.retSetRecord['retainerFee']);
    }

    get retSetSetupFee() {
        return this.formatAmount(this.retSetRecord['setupFee']);
    }

    get retSetTotal() {
        return this.formatAmount(this.retSetRecord['totalAmount']);
    }

    setPaymentFrequency(event) {
        this.constructProgramPlanDataObj(event);
        this.renderUIElementsBasedOnFrequency(); 
    }

    setPaymentTerm(event) {
        this.constructProgramPlanDataObj(event);
        this.paymentTermValue = event.target.value;
    }

    setSetupFee(event) { 
        this.constructProgramPlanDataObj(event);
    }

    setSettlementPercent(event) {
        this.constructProgramPlanDataObj(event);
    }

    setProgramFeePercent(event) {
        this.constructProgramPlanDataObj(event);
    }

    setRetainerPercent(event) {
        this.constructProgramPlanDataObj(event);
    }

    setFirstPaymentDate(event) {
        this.isFirstPaymentDateChanged = true;
        this.constructProgramPlanDataObj(event);
    }

    setFirstPaymentDay(event) {
        this.constructProgramPlanDataObj(event);
    }

    setSecondPaymentDay(event) {
        this.constructProgramPlanDataObj(event);
    }

    setWeeklyPaymentDay(event) {
        this.constructProgramPlanDataObj(event);
    }

    setConsentChange(event) {
        this.consentMovePayments = event.target.checked;
    }

    constructProgramPlanDataObj(event) {
        this.programPlanData[event.target.name] = event.target.value;
    }

    renderUIElementsBasedOnFrequency() { 
        if (this.paymentFrequency == 'Monthly') {
            this.renderNextPaymentDay = true;
            this.renderBiMonthlyPaymentDay = false;
            this.renderWeeklyPaymentDay = false;
        } else if (this.paymentFrequency == 'Bi-Monthly') {
            this.renderNextPaymentDay = true;
            this.renderBiMonthlyPaymentDay = true;
            this.renderWeeklyPaymentDay = false;
        } else if (this.paymentFrequency == 'Weekly') {
            this.renderNextPaymentDay = false;
            this.renderBiMonthlyPaymentDay = false;
            this.renderWeeklyPaymentDay = true;
        } else if (this.paymentFrequency == 'Daily') {
            this.renderNextPaymentDay = false;
            this.renderBiMonthlyPaymentDay = false;
            this.renderWeeklyPaymentDay = false;
        } 
    }

    @wire(getPicklistValues, {
        fieldApiName: PAYMENT_FREQUENCY_FIELD,
        recordTypeId: "$label.nullRecordTypeId"
    })
    getFrequencyValues({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.paymentFrequencies = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: PAYMENT_TERM_FIELD,
        recordTypeId: "$label.nullRecordTypeId"
    })
    getPaymentTerms({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.paymentTerms = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: SETUP_FEE_FIELD,
        recordTypeId: "$label.nullRecordTypeId"
    })
    getSetupFee({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.setupFeeValues = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: SETTLEMENT_PERCENT_FIELD,
        recordTypeId: "$label.nullRecordTypeId"
    })
    getSettlementPercent({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.settlementPercentages = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: PROGRAM_FEE_PERCENT_FIELD,
        recordTypeId: '$label.nullRecordTypeId'
    })
    getProgramFeePercent({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.programFeePercentages = [...data.values].sort((a, b) => a.value - b.value);
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: RETAINER_PERCENT_FIELD,
        recordTypeId: '$label.nullRecordTypeId'
    })
    getRetainerFeePercent({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.retainerPercentages = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: NEXT_PAYMENT_DAY_FIELD,
        recordTypeId: '$label.nullRecordTypeId'
    })
    getNextPaymentDay({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.recurringPaymentDays = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: SECOND_PAYMENT_DAY_FIELD,
        recordTypeId: '$label.nullRecordTypeId'
    })
    getSecondPaymentDay({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.secondPaymentDays = [...data.values];
        }
    }

    @wire(getPicklistValues, {
        fieldApiName: WEEKLY_PAYMENT_DAY_FIELD,
        recordTypeId: '$label.nullRecordTypeId'
    })
    getWeeklyPaymentDay({ data, error }) {
        if (error) {
            this.showToast('Failure', 'error', error);
        } else if (data) {
            this.weeklyPaymentDays = [...data.values];
        }
    }

    showToast(title, variant, msg) {
        const event = new ShowToastEvent({
            title: title,
            variant: variant,
            message: msg
        });
        this.dispatchEvent(event);
    }

    formatAmount(amount) {
        if (!amount) {
            return 0.00;
        } 
        return this.roundNumber(amount);
    }

    roundNumber(numberToRound) {
        return parseFloat((Math.round(parseFloat(numberToRound) * 100) / 100).toFixed(2));
    }

    get columns() {
        let self = this;
        return [
            {
                label: 'Payment Date',
                type: "date",
                width: "12.408%",
                footerWidth:"12.408%",
                format:"MM/DD/YYYY",
                editable: function (row) {
                    return (((!self.isDisabled || ( self.isDisabled && editPayments)) && !(row.retSetRecord || row.retainerSetupChildRecord)) ? true : false) &&  
                    (self.stautsToSkipForRetainerFee && self.stautsToSkipForRetainerFee.length && self.stautsToSkipForRetainerFee.indexOf(row.draftStatus) <= -1 ? true : false);
                },
                fieldName: 'paymentDate'
            },
            {
                label: 'Weekly Draft Amount',
                width: "10.344%",
                footerWidth:"10.344%",
                fieldName: 'totalAmount',
                editable: function (row) {
                    return (((!self.isDisabled || ( self.isDisabled && editPayments)) && !(row.retSetRecord || row.retainerSetupChildRecord)) ? true : false) &&  
                        (self.stautsToSkipForRetainerFee && self.stautsToSkipForRetainerFee.length && self.stautsToSkipForRetainerFee.indexOf(row.draftStatus) <= -1 ? true : false);
                    
                },
            attributes: {
                min: 0.1,
                messageWhenUnderFlow: "Payment Amount should be greater than zero."
            },
            type: "currency",
            isTotalCalulate: true
        },
        {
            label: 'Program Fee',
            width: "9.47%",
            footerWidth:"9.47%",
            fieldName: 'programFee',
            type: "currency",
            isTotalCalulate: true
        },
        {
            label: 'Retainer Fee',
            fieldName: 'retainerFee',
            type: "currency",
            width: "9.47%",
            footerWidth:"9.47%",
            isTotalCalulate: true
        },
        {
            label: 'Setup Fee',
            fieldName: 'setupFee',
            type: "currency",
            width: "8.69%",
            footerWidth:"8.69%",
            isTotalCalulate: true
        },
        {
            label: 'Bank Fee',
            fieldName: 'processorFee',
            type: "currency",
            width: "7.81%",
            footerWidth:"7.81%",
            isTotalCalulate: true
        },
        {
            label: 'Service Fee',
            fieldName: 'serviceFee',
            type: "currency",
            width: "8.69%",
            footerWidth:"8.69%",
            isTotalCalulate: true
        },
        {
            label: 'Citaldel Fee',
            fieldName: 'citaldelFee',
            type: "currency",
            width: "8.69%",
            footerWidth:"8.69%",
            isTotalCalulate: true
        },
        {
            label: 'Escrow Amount',
            width: "9.47%",
            footerWidth:"9.47%",
            fieldName: 'paymentAmount',
            type: "currency",
            isTotalCalulate: true
        },
        {
            label: 'Running Balance',
            width: "9.47%",
            footerWidth:"9.47%",
            fieldName: 'runningBalance',
            type: "currency",
            isTotalCalulate: false
        },
        {
            label: 'Status',
            width: "9.47%",
            footerWidth:"9.47%",
            fieldName: 'draftStatus',
            type: "text",
            isTotalCalulate: false
        },
        {
                label: "",
                type: "menuaction",
                width: "4.32%",
                footerWidth: "4.32%",
                items: [
                    {
                        Id: "Add-PaymentRow",
                        title: "Add",
                        iconName: "action:new",
                        type: "icon",
                        iconSize: "xx-small",
                        visible: function (row) {
                            return (!self.showSaveReschedule && (!self.isDisabled || (self.isDisabled && editPayments)) && !(row.retSetRecord || row.retainerSetupChildRecord  || row.draftStatus == 'Skipped Payment')) ? true : false;
                        }
                    },
                    {
                        Id: "Delete-PaymentRow",
                        title: "Delete",
                        iconName: "action:delete",
                        type: "icon",
                        iconSize: "xx-small",
                        visible: function (row) {
                            return (!self.showSaveReschedule &&  row.manuallyAdded && !row.retSetRecord && !row.retainerSetupChildRecord && !self.isDisabled) ? true : false;
                        }
                    },
                    {
                        Id: "Edit-PaymentRow",
                        title: "Edit",
                        iconName: "action:edit",
                        type: "icon",
                        iconSize: "xx-small",
                        visible: function (row) {
                         return !self.showSaveReschedule &&  (!self.isDisabled || (self.isDisabled && editPayments))  && !row.retSetRecord 
                        }
                    },
                    {
                        Id: "Split-RetainerSetupFee",
                        title: "Edit Split",
                        iconName: "action:edit_relationship",
                        type: "icon",
                        iconSize: "x-small",
                        visible: function (row) {
                            return (splitRetainerSetupFee && row.retSetRecord && !self.isDisabled) ? true : false;
                        }
                    },
                    {
                        Id: "Tree-RetainerSetupFee",
                        title: "View Split",
                        iconName: "action:share_poll",
                        type: "icon",
                        iconSize: "x-small",
                        visible: function (row) {
                            return row.retSetRecord  ? true : false;
                        }
                    },
                    {
                        Id: "Skip-PaymentRow",
                        title: "Skip",
                        iconName: "action:adjust_value",
                        type: "icon",
                        iconSize: "xx-small",
                        visible: function (row) {
                            return (!self.showSaveReschedule &&  (!self.isDisabled || (self.isDisabled && editPayments))  && !(row.retSetRecord  || row.draftStatus =='Completed' || row.draftStatus =='NSF' || row.draftStatus == 'Skipped Payment')) ? true : false;
                        }
                    }
                ]
            },
        ];
    }

    get retainerSetupFeeModalColumns() {
        let self = this;
        return [
            {
                label: "Actions",
                type: "action",
                width: "9%",
                items: [{
                    Id: "Add-RSPayment",
                    title: "Add",
                    iconName: "action:new",
                    type: "icon",
                    iconSize: "xx-small"
                  },
                  {
                    Id: "Delete-RSPayment",
                    title: "Delete",
                    iconName: "action:delete",
                    type: "icon",
                    iconSize: "xx-small",
                    visible: function (row) {
                        return self.stautsToSkipForRetainerFee && !self.isDisabled && self.stautsToSkipForRetainerFee.length && self.stautsToSkipForRetainerFee.indexOf(row.draftStatus) <= -1 ? true : false;
                    },
                  }
                ]
            },
            {
                label: 'Payment Date',
                type: "date",
                fieldName: 'paymentDate',
                format:"MM/DD/YYYY",
                editable:  (row) => {
                    return this.stautsToSkipForRetainerFee && this.stautsToSkipForRetainerFee.length && this.stautsToSkipForRetainerFee.indexOf(row.draftStatus) <= -1 ? true : false;
                },
            },
            {
                label: 'Bank Fee',
                fieldName: 'processorFee',
                type: "currency",
                editable: false
            },
            {
                label: 'Citaldel Fee',
                fieldName: 'citaldelFee',
                type: "currency",
                editable: false
            },
            {
                label: 'Payment Amount',
                fieldName: 'totalAmount',
                type: "currency",
                editable:  (row) => {
                    return this.stautsToSkipForRetainerFee && this.stautsToSkipForRetainerFee.length && this.stautsToSkipForRetainerFee.indexOf(row.draftStatus) <= -1 ? true : false;
                },
            },
            {
                label: 'Running Balance',
                fieldName: 'runningBalance',
                editable: false,
                type: "currency"
            }
        ];
    }
    sortRetainerSetupFeeRecords(records) {
        records.sort(function (obj1, obj2) {
            let d1 = new Date(obj1.paymentDate).setHours(0, 0, 0, 0);
            let d2 = new Date(obj2.paymentDate).setHours(0, 0, 0, 0);
            if (d1 < d2) {
                return -1;
            }
            return 1;
        });
        return records;
    }
    calculateTotalMap ;
     getTotalRows(rows) {
        if (this.tableProperties?.isCalculateTotalRow) {
            const totalCalculateRows = {};
            const totalRows = this.columns.map((col, index) => {
                    if (col.isTotalCalulate) {
                        const total = rows.reduce((acc, row) => {
                            if(row.draftStatus != Draft_Status_NSF && row.draftStatus != Draft_Status_Cancelled && row.draftStatus !='Skipped Payment') {
                                return acc + getNumberValue(row[col.fieldName])
                            } 
                            return acc;
                        }, 0);
                        if(col.fieldName == 'totalAmount') {
                            totalCalculateRows['WeeklyPayment'] = rows[index][col.fieldName];
                        }
                        totalCalculateRows[col.fieldName] = total;
                        return { column: col.fieldName, value: total, style:(col.type == 'action') ? `width:${col.footerWidth};padding: 1rem;border-left: 1px solid #c9c9c9;border-bottom: 1px solid #c9c9c9;` :`width:${col.footerWidth};padding: 0.5rem;border-right: 1px solid #c9c9c9;border-bottom: 1px solid #c9c9c9;` };
                    } else {
                        totalCalculateRows[col.fieldName] = rows[col.fieldName];
                        return { column: col.fieldName, value: '',style: (col.type == 'action') ? `width:${col.footerWidth};padding: 1rem;border-left: 1px solid #c9c9c9;border-bottom: 1px solid #c9c9c9;` :`width:${col.footerWidth};padding: 0.5rem;border-right: 1px solid #c9c9c9;border-bottom: 1px solid #c9c9c9;`};
                    }
            });
            totalCalculateRows['totalRetainerFee'] = this.formatAmount(this.totalDebt * (this.retainerPercentage/100));
            totalCalculateRows['setupFee'] = this.setupFee;
            let count = this.retainerSetupFeeRecords.filter(
                record => !this.stautsToSkipForRetainer.includes(record.draftStatus)
            ).length;

            totalCalculateRows['totalRetainerPaymentCount'] = count;
            this.calculateTotalMap = totalCalculateRows;
            this.totalRows = totalRows;
        }
     }

     handleSubmit(event) {
        event.preventDefault(); 
        const fields = event.detail.fields;
        fields.Id = this.selectedRecordId;
        this.showSpinner = true;
        editPaymentRecord({ recordToUpdate: fields })
            .then(() => {
                 this.updatedDraftIds.push(this.selectedRecordId);
                syncDrafts({ updatedDraftIds: this.updatedDraftIds, oppId: this.drecordId})
                .then((syncResult) => {
                       this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                message: 'Payment record updated successfully.',
                                variant: 'success',
                                mode: 'dismissable'
                            })
                        );  
                })
                .catch((error) => {
                    this.showSpinner = false;
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error saving record',
                            message: error.body.message,
                            variant: 'error',
                        })
                    );
                });     
                this.queryDebtDetails();
                this.closeModal();
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error saving record',
                        message: error.body.message,
                        variant: 'error',
                    })
                );
            });
    }
}