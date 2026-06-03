public inherited sharing class FileUtil {
    public static final String AGREEMENT_SAS = 'SAS Agreement';
    public static final String AGREEMENT_COASTAL = 'Coastal Debt - Business Debt Resolution and Settlement Agreement';
    public static final String AGREEMENT_CITADEL = 'Citadel Legal Plan';
    public static final String AGREEMENT_VICTORY = 'Victory Legal Plan';
    public static final String AGREEMENT_RAM = 'Reliant Dedicated Account Agreement And Reliant Services Terms And Conditions';
    public static final String DOCUMENT_SYNC_END_FORMAT = '_completed';
    public static final String CITADEL_LEGAL_PLAN = 'Citadel';

    public static String getFileFormatNameForSync(String fileTitle, String opportunityName) {
        String fileFormatName;
        if (fileTitle.endsWithIgnoreCase(DOCUMENT_SYNC_END_FORMAT)) {
            if (fileTitle.startsWithIgnoreCase(AGREEMENT_SAS)) {
                fileFormatName = AGREEMENT_SAS;
            } else if (fileTitle.startsWithIgnoreCase(AGREEMENT_COASTAL)) {
                fileFormatName = AGREEMENT_COASTAL;
            } else if (fileTitle.startsWithIgnoreCase(AGREEMENT_CITADEL)) {
                fileFormatName = AGREEMENT_CITADEL;
            } else if (fileTitle.startsWithIgnoreCase(AGREEMENT_VICTORY)) {
                fileFormatName = AGREEMENT_VICTORY;
            } else if (fileTitle.startsWithIgnoreCase(AGREEMENT_RAM)) {
                fileFormatName = AGREEMENT_RAM;
            }
        }
        return fileFormatName;
    }
}