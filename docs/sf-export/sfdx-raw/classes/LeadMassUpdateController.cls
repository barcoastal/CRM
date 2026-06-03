public with sharing class LeadMassUpdateController {

    public class ResultWrapper {
        @InvocableVariable(label='Result' description='Concatenated summary of successes and errors (HTML)')
        public String result;
    }

    public class InputWrapper {
        @InvocableVariable(label='LeadList' description='List of Lead records passed from the Flow')
		public List<Lead> leadLists;
        @InvocableVariable(label='LeadNotes' description='List of ContentNote records associated with the Leads, passed from the Flow')
        public List<ContentNote> noteLists;
    }

    @InvocableMethod(label='Lead Mass Update' description='Update Leads with allOrNone=false')
    public static List<ResultWrapper> saveLeads(List<InputWrapper> inputWrapperLists) {
        if (inputWrapperLists == null || inputWrapperLists.isEmpty()) {
            return null;
        }
        List<ResultWrapper> wrapperList = new List<ResultWrapper>();
        List<ContentNote> notesToInsert = new List<ContentNote>();
        ResultWrapper wrapperResult = new ResultWrapper();
		Set<Id> successLeadIds = new Set<Id>();
		Set<Id> leadIds = new Set<Id>();
        List<Lead> leadsToUpdate = new List<Lead>();
        for (Integer j = 0; j < inputWrapperLists.size(); j++) {
            InputWrapper inpWrapper = inputWrapperLists[j];
            notesToInsert = inpWrapper.noteLists;
            leadsToUpdate = inpWrapper.leadLists;
            for (Integer i = 0; i < leadsToUpdate.size(); i++) {
                leadIds.add(leadsToUpdate[i].Id);
            }
        }
        Map<Id, Lead> leadMap = new Map<Id, Lead>([SELECT Id,Name FROM Lead WHERE Id IN: leadIds]);
        Database.SaveResult[] saveResults = Database.update(leadsToUpdate, false);

        List<String> successLines = new List<String>();
        List<String> errorLines = new List<String>();

        for (Integer i = 0; i < saveResults.size(); i++) {
            Database.SaveResult sr = saveResults[i];
            if (sr.isSuccess()) {
                String id = String.valueOf(sr.getId());
                String path = '/lightning/r/Lead/' + id + '/view';
                String link = '<a href="' + path + '" target="_blank" rel="noopener">' + leadMap.get(id).Name + '</a>';
                successLines.add('<li>' + link +'</li>');
                successLeadIds.add(saveResults[i].getId());
            } else {
                String origId = '';
                if (leadsToUpdate[i] != null && leadsToUpdate[i].Id != null) {
                    origId = String.valueOf(leadsToUpdate[i].Id);
                }

                String msg = '';
                for (Database.Error e : sr.getErrors()) {
                    if (e != null) {
                        if (msg != '') msg += ' &nbsp;|&nbsp; ';
                        msg += '[' + String.valueOf(e.getStatusCode()) + '] ' + escapeForHtml(e.getMessage());
                    }
                }

                String recordRef = '';
                if (origId != '') {
                    String path = '/lightning/r/Lead/' + origId + '/view';
                    String link = '<a href="' + path + '" target="_blank" rel="noopener">' + leadMap.get(origId).Name + '</a>';
                    recordRef = link ;
                } 

                errorLines.add('<li>' + recordRef + ' => ' + msg + '</li>');
            }
        }

        List<ContentDocumentLink> linksToInsert = new List<ContentDocumentLink>();
        if (!successLeadIds.isEmpty()) {
            if (notesToInsert != null && !notesToInsert.isEmpty()) {
                insert notesToInsert;
                for (ContentNote note : notesToInsert) {
                    for (Id leadId : successLeadIds) {
                        ContentDocumentLink cdl = new ContentDocumentLink();
                        cdl.ContentDocumentId = note.Id;
                        cdl.LinkedEntityId = leadId;
                        cdl.ShareType = 'V';
                        cdl.Visibility = 'AllUsers';
                        linksToInsert.add(cdl);
                    }
                }
        
                if (!linksToInsert.isEmpty()) {
                    insert linksToInsert;
                }
            }
        }

        String header = '<h3>Lead Mass Update Result</h3>';
        String successHeader = '<h4>SUCCESS: ' + String.valueOf(successLines.size()) + ' record(s)</h4>';
        String successBody = '';
        if (!successLines.isEmpty()) {
            successBody = '<ul>' + String.join(successLines, '') + '</ul>';
        } else {
            successBody = '<p>No successes.</p>';
        }

        String errorHeader = '<h4>ERRORS: ' + String.valueOf(errorLines.size()) + ' record(s)</h4>';
        String errorBody = '';
        if (!errorLines.isEmpty()) {
            errorBody = '<ul>' + String.join(errorLines, '') + '</ul>';
        } else {
            errorBody = '<p>No errors found.</p>';
        }

        wrapperResult.result = header + successHeader + successBody + errorHeader + errorBody;
        wrapperList.add(wrapperResult);
        return wrapperList;
    }

    private static String escapeForHtml(String inputStr) {
        String outputStr = inputStr;
        outputStr = outputStr.replace('&', '&amp;');
        outputStr = outputStr.replace('<', '&lt;');
        outputStr = outputStr.replace('>', '&gt;');
        outputStr = outputStr.replace('"', '&quot;');
        return outputStr;
    }
}