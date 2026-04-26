import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, MessageSquare, ShieldCheck, Loader2, Send, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const ReviewModal = ({ isOpen, onClose, rideId, subject, onReviewSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(`/reviews/${rideId}/${subject._id}`, { rating, comment });
      
      if (data.success) {
        setAnalysisResult(data.data.analysis);
        toast.success('AI Analysis Complete');
        if (onReviewSuccess) onReviewSuccess();
        // We don't close immediately now, we show the analysis card
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setAnalysisResult(null);
    setRating(0);
    setComment('');
    onClose();
  };

  if (!subject || !rideId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white overflow-hidden relative"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic">Elite Feedback</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">
                  {analysisResult ? 'System Analysis Protocol' : `Rating your experience with ${subject.name}`}
                </p>
              </div>
              <button 
                onClick={handleClose}
                className="h-12 w-12 rounded-2xl bg-white hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all flex items-center justify-center shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {!analysisResult ? (
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Star Rating Section */}
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Select Star Protocol</p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHover(star)}
                          onMouseLeave={() => setHover(0)}
                          className="transition-all transform hover:scale-125 focus:outline-none"
                        >
                          <Star
                            size={36}
                            className={`transition-colors ${
                              star <= (hover || rating) 
                                ? 'text-amber-500 fill-amber-500' 
                                : 'text-slate-200'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="text-xs font-black text-amber-600 uppercase tracking-tighter animate-pulse">
                        {rating === 5 ? 'EXCEPTIONAL SERVICE' : rating >= 4 ? 'VERY GOOD' : rating >= 3 ? 'DECENT RIDE' : 'IMPROVEMENT NEEDED'}
                      </p>
                    )}
                  </div>

                  {/* Comment Box */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 block flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-indigo-600" /> Share Experience Details
                      </span>
                      <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold">OPTIONAL</span>
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us about the safety, punctuality, and overall journey experience..."
                      className="w-full h-32 p-6 rounded-3xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white transition-all text-sm font-medium outline-none resize-none placeholder:text-slate-300 shadow-inner"
                    />
                  </div>

                  {/* Safety Shield Info */}
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                    <p className="text-[10px] font-bold text-emerald-700 leading-relaxed uppercase tracking-tight italic">
                      Verified feedback maintained under RaidDosthi Safety Protocol. AI Sentiment analysis active.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white h-16 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none group"
                  >
                    {submitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        SUBMIT VERIFIED FEEDBACK
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {analysisResult.conflictDetected ? (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-8 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                      <div className="h-16 w-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto text-amber-600 shadow-sm border border-amber-200">
                        <AlertCircle size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-amber-900 tracking-tighter uppercase italic mb-2">Conflict Detected</h3>
                        <p className="text-sm font-medium text-amber-700 leading-relaxed italic">
                          Your stars gave a high rating but your description suggests a different experience. We have adjusted the rating to reflect your actual experience.
                        </p>
                      </div>
                      <div className="bg-white/50 py-4 px-6 rounded-2xl border border-amber-100 inline-block">
                         <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">AI Adjusted Rating</p>
                         <p className="text-3xl font-black text-amber-600 tracking-tighter">{analysisResult.finalRatingGiven.toFixed(1)} / 5.0</p>
                      </div>
                    </div>
                  ) : analysisResult.sentimentDetected === 'POSITIVE' ? (
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] p-8 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                      <div className="h-16 w-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm border border-emerald-200">
                        <CheckCircle2 size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-emerald-900 tracking-tighter uppercase italic mb-2">Thank you!</h3>
                        <p className="text-sm font-medium text-emerald-700 leading-relaxed italic">
                          Your detailed feedback helps other passengers choose safely! Positive sentiment detected.
                        </p>
                      </div>
                      <div className="flex justify-around bg-white/50 py-6 px-4 rounded-3xl border border-emerald-100">
                         <div>
                            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">Your Stars</p>
                            <div className="flex gap-0.5">
                               {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={12} className={i < analysisResult.yourStars ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />
                               ))}
                            </div>
                         </div>
                         <div className="w-[1px] bg-emerald-200"></div>
                         <div>
                            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1">Rating Given</p>
                            <p className="text-xl font-black text-emerald-700">{analysisResult.finalRatingGiven.toFixed(1)} / 5.0</p>
                         </div>
                      </div>
                    </div>
                  ) : analysisResult.sentimentDetected === 'NEUTRAL' ? (
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-[2rem] p-8 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                      <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-600 shadow-sm border border-slate-200">
                        <MessageSquare size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Feedback Received</h3>
                        <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                          Thank you for sharing your experience. Your rating has been recorded in our safety database.
                        </p>
                      </div>
                      <div className="flex justify-around bg-white/50 py-6 px-4 rounded-3xl border border-slate-100">
                         <div>
                            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Your Stars</p>
                            <div className="flex gap-0.5">
                               {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={12} className={i < analysisResult.yourStars ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />
                               ))}
                            </div>
                         </div>
                         <div className="w-[1px] bg-slate-200"></div>
                         <div>
                            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest mb-1">Rating Given</p>
                            <p className="text-xl font-black text-slate-700">{analysisResult.finalRatingGiven.toFixed(1)} / 5.0</p>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border-2 border-rose-200 rounded-[2rem] p-8 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                      <div className="h-16 w-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600 shadow-sm border border-rose-200">
                        <AlertTriangle size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-rose-900 tracking-tighter uppercase italic mb-2">Concern Noted</h3>
                        <p className="text-sm font-medium text-rose-700 leading-relaxed italic">
                          We noticed a concern! Your honest feedback protects other passengers. Thank you for being detailed.
                        </p>
                      </div>
                      <div className="flex justify-around bg-white/50 py-6 px-4 rounded-3xl border border-rose-100">
                         <div>
                            <p className="text-[9px] font-black text-rose-800 uppercase tracking-widest mb-1">Your Stars</p>
                            <div className="flex gap-0.5">
                               {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={12} className={i < analysisResult.yourStars ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} />
                               ))}
                            </div>
                         </div>
                         <div className="w-[1px] bg-rose-200"></div>
                         <div>
                            <p className="text-[9px] font-black text-rose-800 uppercase tracking-widest mb-1">Rating Given</p>
                            <p className="text-xl font-black text-rose-700">{analysisResult.finalRatingGiven.toFixed(1)} / 5.0</p>
                         </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white h-16 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95"
                  >
                    CONTINUE
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReviewModal;
