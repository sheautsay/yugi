import { InjectionToken } from '@angular/core';
import type { AnalysisPage } from './analysis-page';

/**
 * The analysis page, handed to the parts its template is split into (settings, controls, history, results,
 * run record). They share one set of signals and actions instead of passing a hundred inputs around.
 */
export const ANALYSIS_PAGE = new InjectionToken<AnalysisPage>('ANALYSIS_PAGE');
