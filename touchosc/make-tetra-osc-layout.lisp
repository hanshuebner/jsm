(in-package :cl-user)

(use-package :cxml)

(defmacro control (&rest keys &key &allow-other-keys)
  `(with-element "control"
     ,@(loop
          for (key value) on keys by #'cddr
          collect `(attribute ,(string-downcase key) ,value))))

;; screen resolution 768x984

(defun make-tetra-pages ()
  (with-xml-output (make-character-stream-sink *standard-output* :indentation 2)
    (with-element "layout"
      (attribute "version" 8)
      (attribute "mode" 1)
      (attribute "orientation" "vertical")
      (with-element "tabpage"
        (attribute "name" "sequencer")
        (dotimes (i 16)
          (let ((y (+ 25 (* i 61)))
                (x 25)
                seq-0-space seq-1-space seq-2-space seq-3-space)
            (control :name (format nil "seq-3-~D-reset" i)
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (incf x 25)
            (control :name (format nil "seq-3-~D" i)
                     :x x
                     :y y
                     :w 57
                     :h 57
                     :color "orange"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (incf x 70)
            (when (zerop i)
              (control :name "seq-3-next-dest"
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "orange"
                     :type "push"
                     :local_off "false")
              (control :name "seq-3-dest"
                       :x x
                       :y (+ y 60)
                       :w 20
                       :h 177
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "orange"
                       :type "labelv"
                       :text ""
                       :size 12
                       :background "true"
                       :outline "true")
              (control :name "seq-3-label"
                       :x x
                       :y 936
                       :w 20
                       :h 60
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "gray"
                       :type "labelv"
                       :text "dHJhY2sgNA=="
                       :size 12
                       :background "true"
                       :outline "false"))
            (incf x 50)
            (control :name (format nil "seq-2-~D-reset" i)
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (incf x 25)
            (control :name (format nil "seq-2-~D" i)
                     :x x
                     :y y
                     :w 57
                     :h 57
                     :color "orange"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (incf x 70)
            (when (zerop i)
              (control :name "seq-2-next-dest"
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "orange"
                     :type "push"
                     :local_off "false")
              (control :name "seq-2-dest"
                       :x x
                       :y (+ y 60)
                       :w 20
                       :h 177
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "orange"
                       :type "labelv"
                       :text ""
                       :size 12
                       :background "true"
                       :outline "true")
              (control :name "seq-2-label"
                       :x x
                       :y 936
                       :w 20
                       :h 60
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "gray"
                       :type "labelv"
                       :text "dHJhY2sgMw=="
                       :size 12
                       :background "true"
                       :outline "false"))
            (incf x 50)
            (control :name (format nil "seq-1-~D-reset" i)
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (incf x 25)
            (control :name (format nil "seq-1-~D" i)
                     :x x
                     :y y
                     :w 57
                     :h 57
                     :color "orange"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (incf x 70)
            (when (zerop i)
              (control :name "seq-1-next-dest"
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "orange"
                     :type "push"
                     :local_off "false")
              (control :name "seq-1-dest"
                       :x x
                       :y (+ y 60)
                       :w 20
                       :h 177
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "orange"
                       :type "labelv"
                       :text ""
                       :size 12
                       :background "true"
                       :outline "true")
              (control :name "seq-1-label"
                       :x x
                       :y 936
                       :w 20
                       :h 60
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "gray"
                       :type "labelv"
                       :text "dHJhY2sgMg=="
                       :size 12
                       :background "true"
                       :outline "false"))
            (incf x 50)
            (control :name (format nil "seq-0-~D-rest" i)
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "gray"
                     :type "toggle"
                     :local_off "true")
            (incf x 25)
            (control :name (format nil "seq-0-~D-reset" i)
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (incf x 25)
            (control :name (format nil "seq-0-~D" i)
                     :x x
                     :y y
                     :w 57
                     :h 57
                     :color "orange"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (incf x 70)
            (when (zerop i)
              (control :name "seq-0-next-dest"
                     :x x
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "orange"
                     :type "push"
                     :local_off "false")
              (control :name "seq-0-dest"
                       :x x
                       :y (+ y 60)
                       :w 20
                       :h 177
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "orange"
                       :type "labelv"
                       :text ""
                       :size 12
                       :background "true"
                       :outline "true")
              (control :name "seq-0-label"
                       :x x
                       :y 936
                       :w 20
                       :h 60
                       :scalef "0.0"
                       :scalet "1.0"
                       :color "gray"
                       :type "labelv"
                       :text "dHJhY2sgMQ=="
                       :size 12
                       :background "true"
                       :outline "false"))
            (incf x 50)))))))